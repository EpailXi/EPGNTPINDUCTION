const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const ImageModule = require('docxtemplater-image-module-free');
const archiver = require('archiver');
const libre = require('libreoffice-convert');
const { PDFDocument } = require('pdf-lib');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname);

app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(PUBLIC_DIR));

let latestPdf = null;

app.post('/webhook/induction', async (req, res) => {
  try {
    const fv = req.body.field_values;
    const id = uuidv4();
    const docxName = `form_${id}.docx`;
    const pdfName = `form_${id}.pdf`;
    const finalPdfPath = path.join(PUBLIC_DIR, pdfName);

    const fields = {
      CompanyName: fv.company,
      Designation: fv.designation,
      Name: fv.name,
      IDNumber: fv.ic_passport,
      PassportExpiry: fv.passport_expiry,
      WorkPermitExpiry: fv.work_permit_expiry,
      Nationality: fv.nationality,
      DOB: fv.date_of_birth,
      CIDBExpiry: fv.cidb_expiry,
      ContactNo: fv.contact_no,
      EmergencyName: fv.emergency_contact_name,
      EmergencyNo: fv.emergency_contact_no,
      Photo1: fv.photo_url_1,
      Photo2: fv.photo_url_2,
    };

    const templatePath = path.join(__dirname, 'templates', 'induction-template.docx');
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);

    const imageOpts = {
      getImage: async url => (await axios.get(url, { responseType: 'arraybuffer' })).data,
      getSize: () => [150, 150]
    };

    const doc = new Docxtemplater(zip, { modules: [new ImageModule(imageOpts)] });
    doc.setData(fields);
    doc.render();
    const docxBuf = doc.getZip().generate({ type: 'nodebuffer' });
    const docxPath = path.join(PUBLIC_DIR, docxName);
    fs.writeFileSync(docxPath, docxBuf);

    const pdfBuf = await new Promise((resolve, reject) => {
      libre.convert(docxBuf, '.pdf', undefined, (err, done) => {
        if (err) return reject(err);
        resolve(done);
      });
    });
    fs.writeFileSync(finalPdfPath, pdfBuf);

    // Optionally merge attachments here into PDF using pdf-lib
    // Or create a ZIP if needed

    latestPdf = `/${pdfName}`;
    res.json({ downloadUrl: latestPdf });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/webhook/induction', (req, res) => {
  if (!latestPdf) return res.status(404).json({ error: 'No recent file' });
  res.json({ downloadUrl: latestPdf });
});

// Auto-delete files older than 24h
setInterval(() => {
  fs.readdir(PUBLIC_DIR, (err, files) => {
    if (err) return;
    files.filter(file => file.endsWith('.pdf') || file.endsWith('.docx')).forEach(file => {
      const filePath = path.join(PUBLIC_DIR, file);
      fs.stat(filePath, (err, stats) => {
        if (!err && Date.now() - stats.birthtimeMs > 24 * 3600 * 1000) {
          fs.unlink(filePath).catch(console.error);
        }
      });
    });
  });
}, 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
