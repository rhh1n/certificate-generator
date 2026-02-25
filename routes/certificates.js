const express = require('express');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
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
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 180 });
    const qrImageBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    const logo = resolveLogo();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=certificate-${certificate.certificateId}.pdf`
    );

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    doc.pipe(res);

    doc.rect(16, 16, 810, 563).lineWidth(4).stroke('#0f172a');
    doc.rect(28, 28, 786, 539).lineWidth(1.5).stroke('#b45309');
    doc.rect(38, 38, 766, 519).lineWidth(0.8).stroke('#64748b');

    doc.rect(38, 38, 766, 22).fill('#0f172a');
    doc.rect(38, 535, 766, 22).fill('#0f172a');

    doc.fillColor('#ffffff').fontSize(10).text('ONLINE CERTIFICATE GENERATION & VERIFICATION SYSTEM', 42, 44, {
      width: 758,
      align: 'center'
    });
    doc.fillColor('#ffffff').fontSize(10).text('AUTHENTICATED | TRACKABLE | SECURE', 42, 541, {
      width: 758,
      align: 'center'
    });

    if (logo) {
      doc.image(logo.absolute, 366, 72, { fit: [110, 110], align: 'center' });
    }

    doc.fontSize(14).fillColor('#334155').text('SRINIVAS GROUP', 0, 190, {
      align: 'center'
    });
    doc.fontSize(11).fillColor('#64748b').text('Samagra Gnana | ESTD: 1988', 0, 208, {
      align: 'center'
    });

    doc.moveDown(1.2);
    doc.fontSize(34).fillColor('#0f172a').text('Certificate of ' + certificate.certificateType, 0, 244, {
      align: 'center'
    });

    doc.moveDown(0.8);
    doc.fontSize(15).fillColor('#334155').text('This certificate is proudly presented to', { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(37).fillColor('#92400e').text(certificate.studentName, {
      align: 'center',
      underline: true
    });

    doc.moveDown(0.75);
    doc.fontSize(17).fillColor('#0f172a').text(
      `For ${certificate.certificateType.toLowerCase()} in "${certificate.eventName}"`,
      { align: 'center' }
    );

    doc.moveDown(0.5);
    doc.fontSize(13).fillColor('#334155').text(`Course: ${certificate.course} | USN: ${certificate.usn}`, {
      align: 'center'
    });

    doc.moveDown(0.4);
    doc.text(
      `Event Date: ${new Date(certificate.eventDate).toLocaleDateString()} | Issued: ${new Date(
        certificate.issuedDate
      ).toLocaleDateString()}`,
      {
        align: 'center'
      }
    );

    doc.lineWidth(1).moveTo(90, 455).lineTo(270, 455).stroke('#64748b');
    doc.lineWidth(1).moveTo(560, 455).lineTo(740, 455).stroke('#64748b');
    doc.fontSize(11).fillColor('#334155').text('Authorized Signature', 120, 460);
    doc.fontSize(11).fillColor('#334155').text('Coordinator', 625, 460);

    doc.fontSize(11).fillColor('#1d4ed8').text(`Certificate ID: ${certificate.certificateId}`, 70, 495);
    doc.fontSize(10).fillColor('#475569').text('Verify via QR or URL: ' + verifyUrl, 70, 513);

    doc.image(qrImageBuffer, 666, 376, { fit: [122, 122] });
    doc.rect(662, 372, 130, 130).lineWidth(1).stroke('#475569');

    const corners = [
      [50, 50],
      [790, 50],
      [50, 545],
      [790, 545]
    ];
    corners.forEach(([x, y]) => {
      doc.circle(x, y, 7).fill('#b45309');
    });

    doc.end();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
