const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();
const sendConfirmationEmail = async(email, eventName) => {
    console.log("Attempting to send email to:", email);
    try{
        console.log("Creating transporter with:", {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD ? "****" : "missing",
        });
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth:{
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_APP_PASSWORD,
            }
        });
        await transporter.verify();
        console.log("Transporter verified Confirmation");
        const mailOptions = {
            from : process.env.EMAIL_USER,
            to: email,
            subject: "Event Registration Confirmation",
            html: `
                <div style="font-family: Arial,
                sans-serif; padding: 20px;">
                    <h2>Event Registration Confirmation</h2>
                    <p>Thank you for registering for ${eventName}!</p>
                    <p>We look forward to seeing you at the event.</p>
                </div>
            `,
            text: `You're registered for ${eventName}!`,
        }
        console.log('Sending email with options:', {
            to: mailOptions.to,
            subject: mailOptions.subject
        });
        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent successfully:", info.response);
        return info;
    }catch(err){
        console.log("Email sending failed:", err);
        throw err;
    }
};
module.exports = sendConfirmationEmail;


