import moment from 'moment';
import S3 from './S3.js';
import config from '../config/default.js';
import { sendEmail } from '../utils/email.js';
import Boom from '@hapi/boom';

export const globalFailAction = (request, h, err) => {
  const message = err.details?.map(d => d.message).join(', ') || err.message;
  throw Boom.badRequest(message);
};

export const therapeuticAreaNameConversion = (name) => {
    const splitName = name.split('-');
    let len = splitName.length - 1;
    if (splitName.includes('deleted')) {
      len = len - 1;
    }
    if (len > 0 && splitName?.length) {
      return splitName.slice(0, len).join('-');
    }
    return splitName.join('-')
}

export const extractDomainParts = (url) => {
  try {
    const parsedUrl = new URL(url);
    console.log(parsedUrl);
    return {
      protocol: parsedUrl.protocol.replace(':', ''),
      host: parsedUrl.hostname + ':' + config?.backendPort,
    };
  } catch (error) {
    console.error('Invalid URL:', url);
    return null;
  }
};

export const getHapiHost = extractDomainParts(config?.clientHost || 'http://localhost:3000')

export const inviteMessage = (toEmails) => {
  return toEmails.map((recipient) => { return recipient.name; }).reduce((message, name, index, names) => {
    const len = names.length;
    if (len === 1) {
      message += name;
    } else if (index < len - 2) {
      message += `${name}, `;
    } else if (index < len - 1) {
      message += `${name} and ${names[index + 1]}`;
    }
    return message;
  }, '');
}

export const updateColumnWidths = (columns, updates) => {
  updates.forEach(update => {
    const column = columns.find(col => col.field === update.name);
    if (column) {
      column.width = update.width;
    }
  });
  return columns;
}


export const tvSOP04275 = "https://truvaultviewer.jnj.com/general/search/Property?aDocId=6C23E144-AE92-4C29-83DF-6BDAE50F14B5&aRepo=TV";
export const sharePointLink = "https://jnj.bravais.com/s/gMP8CxWDpxWANUnivIbS";
export const clinicalSharePointLink = "https://jnj.bravais.com/s/0JPAXPTgvSTHWIEuR71w";

export const dtrMailContent = (dtrRequest, currentUser, type, invitees, link, shouldIncludeAttachment) => {
  switch (type) {
    case "APPROVERS_MAIL": {
      return {
        subject: `Data Transfer Request (${dtrRequest.displayId}) approval required for ${dtrRequest.displayName}.`,
        html: `Dear Approver,
        <br><br>
        <span>A data reuse request has been submitted and is now available for your review/approval, as required by <a href="${tvSOP04275}">TV-SOP-04275</a>.</span>
        <br><br>
        <b>The full request can be viewed <a href="${link}">here</a>.</b>
        <br><br>
        <ul>
          <li>If you have not approved requests in SCOPE before, please request access via the ‘Request access to Scope’ button.</li>
          <li>You have been designated as the CDTL for the compound in SCOPE. If this information is incorrect, please send an email to 
          <a href="mailto:RA-DataTransparencyD@ITS.JNJ.com">RA-DataTransparencyD@ITS.JNJ.com</a> and provide the correct name.</li>
        </ul>
        <br>
        <span>Please review the proposed use and privacy assessment form and seek input from other CDT members before making a decision to approve/reject on behalf of the CDT. The requestor, statistical leader and programming leads are included in this email.</span>
        For further guidance, please see job aid <a href="${sharePointLink}">Approve Compatible or Secondary Use Request</a></span>
        <br>
        <br>
        ${!shouldIncludeAttachment ? '<p style="color: red;">Attachment too large to email. The attachment(s) will be available on the request’s details page in Scope.</p>' : ''}
        <br>Sincerely,
        <br>Team Scope<br><br>`,
      }
    }
    case "REJECTED_MAIL": {
      return {
        subject: `Data Transfer Request rejected ${dtrRequest.displayName} - ${dtrRequest.displayId}`,
        html: `Dear Requestor,
              <br><br>
              <span><b>Your Data Reuse Request has been rejected.</b>See the request details found <a href="${link}">here</a> for reasons.</span>
              <br>
              <br>Sincerely,
              <br>Team Scope<br><br>`,
        }
    }
    case "ACCEPTED_MAIL": {
      return {
        subject: `Data Transfer Request (${dtrRequest.displayId}) approved succesfully for ${dtrRequest.displayName}`,
        html: `Dear Requestor,
              <br><br>
              <span><b>Your Data Reuse Request:</b> has been approved successfully.</span>
              <br><br>
              <b>The full request can be viewed <a href="${link}">here</a>.</b>
              <br><br>
              <span>As required by <a href="${tvSOP04275}">TV-SOP-04275</a>, the requestor must now work with the data custodians (cc’ed) to make the data available for the approved use. See job aid <a href="${clinicalSharePointLink}">Prepare Clinical Study Data for further information</a>.</span>
              <br><br>Sincerely,
              <br>Team Scope<br><br>`,
        }
    }
  }
}

export const contentdrrProjectLeadChange = (project) => {
  const link = `${process.env.UI_HOST}/dashboard/projects/detail-${project.projectID}`
  return {
    subject: `Lead update for DRR Project ${project.displayName}`,
    html: `Dear ${project.lead.displayName},
          <br><br>
          <span>You have been made a lead for project <a href="${link}">${project.displayId}</a>.</span>
          <br><br>
          <br><br>Sincerely,
          <br>Team Scope<br><br>`,
    }
}

export const convertStringToArray = (data) => {
  let rData = data;
  if (data?.text) {
    rData = data?.text;
  }
  return (rData === '-' || !rData) ? [] : rData?.split(', ');
}

export const extractEmailFromArray = (arr, type) => {
  if (Array.isArray(arr)) {
    return arr.map((item) => item[`${type}`]);
  }
  return arr;
}

export const removeDuplicates = (array) => {
  const seen = {}; // to store unique keys
  return array.reduce((result, item) => {
      const lowerCaseKey = item.key.toLowerCase(); // Convert key to lowercase
      if (!seen[lowerCaseKey]) { // if key is not seen before
          result.push(item); // add it to result
          seen[lowerCaseKey] = true; // mark it as seen
      }
      return result;
  }, []);
}

export const uploadCustomFieldsAttachments = (type, files, id, fieldName) => {
  return new Promise(async (resolve, reject) => {
    try {
      const s3 = new S3();
      const prefix = process.env.NODE_ENV === 'production' ? `production/${type}` : `staging/${type}`;
      const defaultUploadPath = `${prefix}/${id}/${fieldName}/`;
      const uploads = files.map((file) => {
        return new Promise(async (res, rej) => {
          try {
            const content = new Buffer.from(file.data);
            const fileName = defaultUploadPath + file.name;
            const response = await s3.upload(fileName, content)
            return res(response)
          } catch (error) {
            return rej(error);
          }
        });
      });
      return resolve(await Promise.all(uploads));
    } catch (error) {
      return reject({ code: 500, message: 'Failed to upload attachments', error });
    }
  })
}

export const getDayDifference = (date1, date2) => {
  const d1 = moment(date1, "MM/DD/YYYY");
  const d2 = moment(date2, "MM/DD/YYYY");
  return d2.diff(d1, 'days');
}

export const handleSmtpException = async (error) => {
  const errorTime = moment().format('YYYY-MM-DD HH:mm:ss');
  const emailTemplate = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #ddd;">
      <h2 style="color: #d9534f;">🚨 Critical Server Error</h2>
      <p><strong>Error Message:</strong> ${error?.message || 'An unknown error occurred.'}</p>
      <p><strong>Timestamp:</strong> ${errorTime}</p>
      <p><strong>Stack Trace:</strong></p>
      <pre style="background: #f4f4f4; padding: 10px; border-radius: 5px;">${error?.stack || 'No stack trace available.'}</pre>
      <p><strong>Severity:</strong> <span style="color: red;">HIGH</span></p>
      <hr>
      <p style="color: #888;">This is an automated alert. Please check the server logs.</p>
  </div>`;

  const mailOptions = {
    to: process.env.UNCAUGHT_EXCEPTION_EMAIL,
    subject: '🚨 Uncaught Exception in Server!',
    html: emailTemplate
  };
  try {
    await sendEmail(mailOptions);
  } catch (emailError) {
    logger.error('Failed to send error email:', emailError);
  }
};

export const extractUserNameFromLDAPManyValue = (value) => value.split(', ').map((val) => val.split(')')[0]?.split('(')[1]?.toLowerCase());

export const formatFullName = (fullName) => {
  return fullName
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
