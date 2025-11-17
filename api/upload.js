import nodemailer from "nodemailer";
import cloudinary from "cloudinary";

// Large JSON support
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "15mb",
    },
  },
};

// Cloudinary config
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {

  // ---------------------------
  // 🔥 FULL CORS FIX (Netlify + Local + Any domain)
  // ---------------------------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  // ---------------------------

  if (req.method !== "POST") {
    return res.status(405).json({ msg: "Only POST allowed" });
  }

  try {
    const {
      image,
      gpsLocation,
      dateTime,
      deviceModel,
      browser,
      resolution,
    } = req.body;

    if (!image) {
      return res.status(400).json({ error: "No image received" });
    }

    // Upload to Cloudinary
    const uploadRes = await cloudinary.v2.uploader.upload(image, {
      folder: "user_photos",
    });

    const photoURL = uploadRes.secure_url;

    // Nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    const ipLocationLink = `https://www.google.com/maps?q=${gpsLocation || ""}`;

    // HTML email
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER,
      subject: "New Photo Uploaded ✔",
      html: `
        <h2>New Photo Uploaded</h2>

        <p><b>Date:</b> ${dateTime}</p>
        <p><b>Device:</b> ${deviceModel}</p>
        <p><b>Browser:</b> ${browser}</p>
        <p><b>Resolution:</b> ${resolution}</p>

        <p><b>GPS / IP Location:</b> 
           <a href="${ipLocationLink}" target="_blank">Open Location</a>
        </p>

        <br>

        <a href="${photoURL}" target="_blank"
           style="padding:10px 16px; background:#007bff; color:white;
                  border-radius:6px; text-decoration:none;">
            View Uploaded Photo
        </a>

        <br><br>

        <img src="${photoURL}" width="220" style="border-radius:10px;">
      `,
    });

    return res.status(200).json({
      success: true,
      message: "Uploaded + Email Sent",
      url: photoURL,
    });

  } catch (error) {
    console.error("UPLOAD ERROR:", error);
    return res.status(500).json({ error: error.message });
  }
}
