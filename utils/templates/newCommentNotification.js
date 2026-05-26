const newCommentNotification = (host, projectId) => {
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>New Comment Notification</title>
  </head>
  <body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color:#f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f4">
      <tr>
        <td align="center" style="padding: 30px 15px;">
          <table width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="border-radius:8px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.1);">
            <!-- Header -->
            <tr>
              <td bgcolor="#004085" style="padding:20px; text-align:center; color:#ffffff; font-size:20px; font-weight:bold;">
                Scope Project Notification
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding: 30px; color:#333333; font-size:15px; line-height:1.6;">
                <p>Dear Project Team,</p>
                <p>
                  A new comment has been added to your project.  
                </p>
                <p style="text-align:center; margin:30px 0;">
                  <a href="${host}/smh/projects/detail-${projectId}"
                     style="background-color:#007bff; color:#ffffff; padding:12px 20px; text-decoration:none; border-radius:5px; font-weight:bold;">
                    View Project
                  </a>
                </p>
                <p>Regards, <br/> <strong>Team Scope</strong></p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td bgcolor="#f1f1f1" style="padding:15px; text-align:center; font-size:12px; color:#777;">
                © ${new Date().getFullYear()} Scope | This is an automated email, please do not reply.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`
}

export default newCommentNotification;