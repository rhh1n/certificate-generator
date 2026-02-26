const express = require('express');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

const Certificate = require('../models/Certificate');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const LOGO_CANDIDATES = [
  { file: 'srinivas-logo.png', web: '/images/srinivas-logo.png' },
  { file: 'srinivas-logo.jpg', web: '/images/srinivas-logo.jpg' },
  { file: 'srinivas-logo.jpeg', web: '/images/srinivas-logo.jpeg' },
  { file: 'logo.png', web: '/images/logo.png' },
  { file: 'logo.jpg', web: '/images/logo.jpg' }
];

function cleanText(value) {
  return String(value || '')
    .trim()
    .replace(/[<>]/g, '');
}

function resolveLogo() {
  for (const candidate of LOGO_CANDIDATES) {
    const absolute = path.join(__dirname, '..', 'public', 'images', candidate.file);
    if (fs.existsSync(absolute)) {
      return { absolute, web: candidate.web };
    }
  }
  return null;
}

function buildMailer() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

  if (!host || !user || !pass) {
    throw new Error('Missing SMTP configuration.');
  }

 return nodemailer.createTransport({
  host,
  port,
  secure,
  auth: { user, pass },
  requireTLS: true,
  family: 4,
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000
});


}

function renderCertificatePdf(doc, certificate, verifyUrl, qrImageBuffer, logo) {
  const pageWidth = 842;
  const pageHeight = 620;

  doc.rect(16, 16, pageWidth - 32, pageHeight - 32).lineWidth(4).stroke('#0f172a');
  doc.rect(28, 28, pageWidth - 56, pageHeight - 56).lineWidth(1.8).stroke('#b45309');
  doc.rect(38, 38, pageWidth - 76, pageHeight - 76).lineWidth(0.9).stroke('#94a3b8');

  doc.rect(38, 38, pageWidth - 76, 20).fill('#0f172a');
  doc.rect(38, pageHeight - 83, pageWidth - 76, 20).fill('#0f172a');
  doc.fillColor('#ffffff').fontSize(9).text('ONLINE CERTIFICATE GENERATION & VERIFICATION SYSTEM', 42, 44, {
    width: pageWidth - 84,
    align: 'center'
  });
  doc.fillColor('#ffffff').fontSize(9).text('AUTHENTICATED | TRACKABLE | SECURE', 42, pageHeight - 77, {
    width: pageWidth - 84,
    align: 'center'
  });

  doc.moveTo(56, 72).lineTo(772, 72).lineWidth(1).stroke('#d4a756');

  if (logo) {
    doc.image(logo.absolute, 366, 78, { fit: [100, 100], align: 'center' });
  }

  doc.fontSize(15).fillColor('#1f2937').text('SRINIVAS GROUP', 0, 184, { align: 'center' });
  doc.fontSize(11).fillColor('#64748b').text('Samagra Gnana | ESTD: 1988', 0, 204, { align: 'center' });

  doc.fontSize(36).fillColor('#0f172a').text(`Certificate of ${certificate.certificateType}`, 0, 238, {
    align: 'center'
  });
  doc.fontSize(14).fillColor('#64748b').text('This certificate is proudly presented to', 0, 288, {
    align: 'center'
  });
  doc.fontSize(42).fillColor('#92400e').text(certificate.studentName, 0, 314, {
    align: 'center',
    underline: true
  });

  doc.fontSize(16).fillColor('#0f172a').text(
    `For ${certificate.certificateType.toLowerCase()} in "${certificate.eventName}"`,
    0,
    378,
    { align: 'center' }
  );
  doc.fontSize(12).fillColor('#334155').text(`Course: ${certificate.course} | USN: ${certificate.usn}`, 0, 406, {
    align: 'center'
  });
  doc.fontSize(11).fillColor('#475569').text(
    `Event Date: ${new Date(certificate.eventDate).toLocaleDateString()} | Issued: ${new Date(
      certificate.issuedDate
    ).toLocaleDateString()}`,
    0,
    426,
    { align: 'center' }
  );

    doc.image(qrImageBuffer, 138, 448, { fit: [66, 66] });
  doc.rect(134, 444, 74, 74).lineWidth(1.2).stroke('#8fa1bc');

  doc.roundedRect(318, 450, 206, 58, 10).lineWidth(1).stroke('#c9d4e6');
  doc.fontSize(9).fillColor('#64748b').text('CERTIFICATE ID', 318, 463, {
    width: 206,
    align: 'center'
  });
  doc.fontSize(17).fillColor('#0f172a').text(certificate.certificateId, 318, 479, {
    width: 206,
    align: 'center'
  });

  doc.circle(650, 478, 33).lineWidth(3).stroke('#b45309');
  doc.circle(650, 478, 27).lineWidth(1).stroke('#f59e0b');
  doc.fontSize(9).fillColor('#7c2d12').text('VERIFIED', 625, 474, { width: 50, align: 'center' });
}

async function buildCertificatePdfBuffer(certificate, verifyUrl, logo) {
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 180 });
  const qrImageBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: [842, 620], margin: 24 });
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    renderCertificatePdf(doc, certificate, verifyUrl, qrImageBuffer, logo);
    doc.end();
  });
}

async function generateUniqueCertificateId() {
  let attempts = 0;

  while (attempts < 5) {
    const id = uuidv4().replace(/-/g, '').slice(0, 12).toUpperCase();
    const existing = await Certificate.exists({ certificateId: id });
    if (!existing) {
      return id;
    }
    attempts += 1;
  }

  throw new Error('Unable to generate unique certificate ID.');
}

router.get('/dashboard', requireAuth, async (req, res, next) => {
  try {
    const recentCertificates = await Certificate.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    return res.render('dashboard', {
      title: 'Admin Dashboard',
      old: {},
      errors: [],
      recentCertificates
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  '/certificates',
  requireAuth,
  [
    body('studentName').trim().isLength({ min: 2, max: 100 }).withMessage('Student name must be 2-100 characters.'),
    body('studentEmail').trim().isEmail().withMessage('Enter a valid student email.'),
    body('usn').trim().isLength({ min: 2, max: 30 }).withMessage('USN must be 2-30 characters.'),
    body('course').trim().isLength({ min: 2, max: 100 }).withMessage('Course must be 2-100 characters.'),
    body('eventName').trim().isLength({ min: 2, max: 120 }).withMessage('Event name must be 2-120 characters.'),
    body('certificateType')
      .trim()
      .isIn(['Participation', 'Excellence', 'Completion', 'Achievement'])
      .withMessage('Invalid certificate type.'),
    body('eventDate').isISO8601().toDate().withMessage('Invalid event date.')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const recentCertificates = await Certificate.find()
          .sort({ createdAt: -1 })
          .limit(8)
          .lean();

        return res.status(400).render('dashboard', {
          title: 'Admin Dashboard',
          old: req.body,
          errors: errors.array(),
          recentCertificates
        });
      }

      const certificateId = await generateUniqueCertificateId();

      const certificate = await Certificate.create({
        certificateId,
        studentName: cleanText(req.body.studentName),
        studentEmail: cleanText(req.body.studentEmail).toLowerCase(),
        usn: cleanText(req.body.usn).toUpperCase(),
        course: cleanText(req.body.course),
        eventName: cleanText(req.body.eventName),
        certificateType: cleanText(req.body.certificateType),
        eventDate: req.body.eventDate,
        issuedDate: new Date()
      });

      req.session.alert = {
        type: 'success',
        message: `Certificate generated successfully. ID: ${certificate.certificateId}`
      };

      return res.redirect(`/admin/certificates/${certificate.certificateId}/preview`);
    } catch (error) {
      if (error.name === 'ValidationError') {
        const recentCertificates = await Certificate.find()
          .sort({ createdAt: -1 })
          .limit(8)
          .lean();

        return res.status(400).render('dashboard', {
          title: 'Admin Dashboard',
          old: req.body || {},
          errors: [{ msg: 'Please enter all required fields correctly, including student email.' }],
          recentCertificates
        });
      }
      return next(error);
    }
  }
);

router.get('/certificates/:certificateId/preview', requireAuth, async (req, res, next) => {
  try {
    const certificateId = cleanText(req.params.certificateId).toUpperCase();
    const certificate = await Certificate.findOne({ certificateId }).lean();

    if (!certificate) {
      req.session.alert = { type: 'error', message: 'Certificate not found.' };
      return res.redirect('/admin/dashboard');
    }

    const verifyUrl = `${process.env.BASE_URL}/verify/${certificate.certificateId}`;
    const previewQrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 180 });

    return res.render('certificate-preview', {
      title: 'Certificate Preview',
      certificate,
      baseUrl: process.env.BASE_URL,
      logoWebPath: resolveLogo()?.web || null,
      verifyUrl,
      previewQrDataUrl
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/certificates/:certificateId/download', requireAuth, async (req, res, next) => {
  try {
    const certificateId = cleanText(req.params.certificateId).toUpperCase();
    const certificate = await Certificate.findOne({ certificateId }).lean();

    if (!certificate) {
      return res.status(404).render('error', {
        title: 'Not Found',
        message: 'Certificate does not exist.'
      });
    }

    const verifyUrl = `${process.env.BASE_URL}/verify/${certificate.certificateId}`;
    const logo = resolveLogo();

    res.setHeader('Content-Type', 'application/pdf');
    const stamp = Date.now();
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=premium-v2-certificate-${certificate.certificateId}-${stamp}.pdf`
    );

    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 180 });
    const qrImageBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    const doc = new PDFDocument({ size: [842, 620], margin: 24 });
    doc.pipe(res);
    renderCertificatePdf(doc, certificate, verifyUrl, qrImageBuffer, logo);

    doc.end();
  } catch (error) {
    return next(error);
  }
});

router.get('/certificates/:certificateId/send-email', requireAuth, (req, res) => {
  const certificateId = cleanText(req.params.certificateId).toUpperCase();
  req.session.alert = { type: 'error', message: 'Use the email form to send certificate.' };
  return res.redirect(`/admin/certificates/${certificateId}/preview`);
});

router.post(
  '/certificates/:certificateId/send-email',
  requireAuth,
  async (req, res, next) => {
    try {
      const certificateId = cleanText(req.params.certificateId).toUpperCase();

      const certificate = await Certificate.findOne({ certificateId }).lean();
      if (!certificate) {
        req.session.alert = { type: 'error', message: 'Certificate not found.' };
        return res.redirect('/admin/dashboard');
      }

      if (!certificate.studentEmail) {
        req.session.alert = { type: 'error', message: 'No student email found on this certificate.' };
        return res.redirect(`/admin/certificates/${certificateId}/preview`);
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(certificate.studentEmail)) {
        req.session.alert = { type: 'error', message: 'Saved student email is invalid.' };
        return res.redirect(`/admin/certificates/${certificateId}/preview`);
      }

      const verifyUrl = `${process.env.BASE_URL}/verify/${certificate.certificateId}`;
      const logo = resolveLogo();
      const pdfBuffer = await buildCertificatePdfBuffer(certificate, verifyUrl, logo);

      const transporter = buildMailer();
      await transporter.verify();
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: certificate.studentEmail,
        subject: `Certificate Issued: ${certificate.studentName} (${certificate.certificateId})`,
        html: `
          <p>Hello,</p>
          <p>Please find the attached certificate for <strong>${certificate.studentName}</strong>.</p>
          <p>Certificate ID: <strong>${certificate.certificateId}</strong></p>
          <p>Verify online: <a href="${verifyUrl}">${verifyUrl}</a></p>
          <p>Regards,<br/>CertiTrust</p>
        `,
        attachments: [
          {
            filename: `certificate-${certificate.certificateId}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      });

      req.session.alert = {
        type: 'success',
        message: `Certificate emailed successfully to ${certificate.studentEmail}.`
      };
      return res.redirect(`/admin/certificates/${certificateId}/preview`);
    } catch (error) {
      if (error.message === 'Missing SMTP configuration.') {
        req.session.alert = {
          type: 'error',
          message: 'Email is not configured. Add SMTP settings in .env.'
        };
        return res.redirect(`/admin/certificates/${cleanText(req.params.certificateId).toUpperCase()}/preview`);
      }
      return next(error);
    }
  }
);

module.exports = router;
