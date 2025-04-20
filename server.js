const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const ImageModule = require('docxtemplater-image-module-free');
const axios = require('axios');
const archiver = require('archiver');

let latestDownload = null;

const app = express();
app.use(bodyParser.json());
app.use(express.static(__dirname));

app.get('/webhook/induction', (req, res) => {
  res.send('✅ Webhook endpoint is live. Use POST method.');
});
  const fv = req.body.field_values;

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

  const tpl = fs.readFileSync('./templates/induction-template.docx', 'binary');
  const zip = new PizZip(tpl);
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

  const ts = Date.now();
  const docxPath = `./public/induction_${ts}.docx`;
  const zipPath = `./public/induction_${ts}.zip`;
  fs.writeFileSync(docxPath, buffer);

  // Attachments (optional uploads)
  const attachments = [fv.ic_copy_url, fv.vaccine_cert_url].filter(Boolean);
  const archive = archiver('zip');
  const output = fs.createWriteStream(zipPath);
  archive.pipe(output);
  archive.file(docxPath, { name: 'Induction_Form.docx' });

  for (let i = 0; i < attachments.length; i++) {
    const file = await axios.get(attachments[i], { responseType: 'arraybuffer' });
    archive.append(file.data, { name: `attachment_${i + 1}.jpg` });
  }

  await archive.finalize();

  latestDownload = `https://${req.get('host')}/induction_${ts}.zip`;

  res.json({ downloadUrl: latestDownload });
});

app.get('/latest', (req, res) => {
  if (!latestDownload) {
    return res.status(404).json({ error: 'No recent form available.' });
  }
  res.json({ downloadUrl: latestDownload });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
const ONE_DAY = 24 * 60 * 60 * 1000;

setInterval(() => {
  const directory = __dirname;

  fs.readdir(directory, (err, files) => {
    if (err) return console.error('Error reading directory:', err);

    files.forEach(file => {
      if (!file.endsWith('.docx') && !file.endsWith('.zip')) return;

      const filePath = path.join(directory, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return console.error('Error reading file stats:', err);

        const now = Date.now();
        const created = new Date(stats.birthtime).getTime();

        if (now - created > ONE_DAY) {
          fs.unlink(filePath, err => {
            if (err) console.error('Failed to delete file:', file, err);
            else console.log('Deleted old file:', file);
          });
        }
      });
    });
  });
}, 60 * 60 * 1000); // ⏱ Runs every 1 hour
