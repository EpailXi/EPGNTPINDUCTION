const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const ImageModule = require('docxtemplater-image-module-free');
const axios = require('axios');
const archiver = require('archiver');

const app = express();
app.use(bodyParser.json());

// 1) Serve static assets from /public
app.use(express.static(path.join(__dirname, 'public')));

// 2) Serve index.html from project root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 3) Webhook endpoint
app.post('/webhook/induction', async (req, res) => {
  const fv = req.body.field_values;  // Lark Base form data

  // Map form fields to template tags
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
    Photo2: fv.photo_url_2
  };

  // Load & fill the Word template
  const tplPath = path.join(__dirname, 'templates', 'induction-template.docx');
  const template = fs.readFileSync(tplPath, 'binary');
  const zip = new PizZip(template);
  const imageOpts = {
    centered: false,
    getImage: async url => {
      const resp = await axios.get(url, { responseType: 'arraybuffer' });
      return resp.data;
    },
    getSize: () => [150, 150]
  };
  const doc = new Docxtemplater(zip, { modules: [ new ImageModule(imageOpts) ] });
  doc.setData(fields);
  doc.render();
  const buffer = doc.getZip().generate({ type: 'nodebuffer' });

  // Save filled DOCX
  const timestamp = Date.now();
  const docxName = `induction_${timestamp}.docx`;
  const docxPath = path.join(__dirname, 'public', docxName);
  fs.writeFileSync(docxPath, buffer);

  // Collect any uploaded attachments
  const attachmentUrls = [
    fv.ic_copy_url,
    fv.workpermit_copy_url,
    fv.vaccine_cert_url
    // add more if needed
  ].filter(Boolean);

  // Create a ZIP containing the DOCX + attachments
  const zipName = `induction_${timestamp}.zip`;
  const zipPath = path.join(__dirname, 'public', zipName);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip');

  archive.pipe(output);
  archive.file(docxPath, { name: 'Induction_Form.docx' });

  for (let i = 0; i < attachmentUrls.length; i++) {
    const url = attachmentUrls[i];
    const resp = await axios.get(url, { responseType: 'arraybuffer' });
    const ext = path.extname(new URL(url).pathname) || '.dat';
    archive.append(resp.data, { name: `attachment_${i+1}${ext}` });
  }

  await archive.finalize();

  output.on('close', () => {
    res.json({ downloadUrl: `${req.protocol}://${req.get('host')}/${zipName}` });
  });
});

// 4) Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
