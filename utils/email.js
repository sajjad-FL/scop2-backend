import config from '../config/default.js';
import nodemailer from 'nodemailer';
import { logger } from './logger.js';

export const sendEmail = (data) => {
  return new Promise((resolve, reject) => {
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      tls: {
        // do not fail on invalid certs
        rejectUnauthorized: false,
      },
    });
  
    const mailOptions = {
      from: 'noreply@its.jnj.com',
      to: data.to,
      cc: data.cc,
      subject: data.subject,
      html: data.html,
      attachments: data.attachments,
    };

    if (data?.bcc) {
      mailOptions['bcc'] = data.bcc;
    }

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        logger.error(error, 'ERROR_SEND_EMAIL');
        process.emit('emailFailed', { message: 'Failed to send Email', error });
        return reject(error);
      }
      logger.info(`Email sent: subject: ${data.subject || 'N/A'} to: ${data.to || 'N/A'} cc: ${data.cc || 'N/A'} ${info.response}`);
      return resolve(info);
    });
  })
};
