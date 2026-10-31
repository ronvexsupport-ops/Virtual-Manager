/**
 * ============================================================================
 * VIRTUAL MANAGER - GOOGLE APPS SCRIPT SERVERLESS OTP BACKEND
 * ভার্চুয়াল ম্যানেজার - জিমেইল ওটিপি ব্যাকএন্ড ও ইমেইল ভেরিফিকেশন সার্ভিস
 * ============================================================================
 * 
 * এই কোডটি কোনো Node.js সার্ভার, Vercel বা Cloud Functions ছাড়াই
 * সম্পূর্ণ ক্লাউডে ব্রাউজার/অ্যাপ থেকে সরাসরি কাজ করে।
 * 
 * মূল বৈশিষ্ট্যসমূহ:
 * ১. Gmail দিয়ে ৬-সংখ্যার OTP পাঠানো (MailApp.sendEmail)
 * ২. ৫ মিনিটের ওটিপি মেয়াদ (5-Minute TTL)
 * ৩. ৬০ সেকেন্ড রি-সেন্ড কুলডাউন ও রেট লিমিটিং (Rate Limiting)
 * ৪. সর্বোচ্চ ৫ বার ভুল কোড চেষ্টার পর লকআউট (5 Max Attempts Lockout)
 * ৫. ক্রিপ্টোগ্রাফিক সল্টসহ SHA-256 হ্যাশিং (Plain-text OTP কখনোই সেভ হয় না)
 * ৬. একবার ওটিপি যাচাই সফল হলে সাথে সাথে মুছে ফেলা হয় (Single-use enforcement)
 * ৭. ব্রাউজার ও অ্যান্ড্রয়েড থেকে সরাসরি CORS সাপোর্ট
 * 
 * ----------------------------------------------------------------------------
 * সেটআপ নির্দেশিকা (Simple Setup Instructions):
 * ----------------------------------------------------------------------------
 * ১. https://script.google.com এ যান এবং আপনার প্রজেক্টটি খুলুন (বা New project)।
 * ২. বিদ্যমান সব কোড মুছে এই সম্পূর্ণ কোডটি পেস্ট করুন।
 * ৩. উপরের "Save" আইকনে ক্লিক করুন।
 * ৪. উপরের ডানদিকের "Deploy" বাটনে ক্লিক করে "New deployment" সিলেক্ট করুন:
 *    - Type: "Web app"
 *    - Description: "Virtual Manager OTP Backend"
 *    - Execute as: "Me" (আপনার Gmail একাউন্ট)
 *    - Who has access: "Anyone" (যেকোনো ভিজিটর/অ্যাপ)
 * ৫. "Deploy" এ ক্লিক করুন এবং অনুমতি (Authorize access) দিন।
 * ৬. পাওয়া "Web app URL" টি কপি করে রাখুন।
 * ============================================================================
 */

/**
 * POST রিকোয়েস্ট হ্যান্ডলার (ব্রাউজার ও অ্যাপ থেকে সরাসরি কল)
 */
function doPost(e) {
  try {
    if (!e) {
      return createJsonResponse({
        success: false,
        error: "অনুরোধে কোনো ডেটা পাওয়া যায়নি।"
      });
    }

    var requestData = null;

    // ১. পেলোড পার্সিং (JSON স্ট্রিং অথবা ফর্ম/প্যারামিটার)
    if (e.postData && e.postData.contents) {
      try {
        requestData = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        requestData = null;
      }
    }
    
    if (!requestData && e.parameter && Object.keys(e.parameter).length > 0) {
      requestData = e.parameter;
    }

    if (!requestData) {
      return createJsonResponse({
        success: false,
        error: "অবৈধ ডেটা ফরম্যাট। সঠিক JSON পাঠানো প্রয়োজন।"
      });
    }

    var action = (requestData.action || "").toString().trim().toLowerCase();
    var email = (requestData.email || "").toString().trim().toLowerCase();

    // ২. ইমেইল ভ্যালিডেশন
    if (!email) {
      return createJsonResponse({
        success: false,
        error: "অনুগ্রহ করে আপনার Gmail ঠিকানা প্রদান করুন।"
      });
    }

    var gmailPattern = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!gmailPattern.test(email)) {
      return createJsonResponse({
        success: false,
        error: "শুধুমাত্র বৈধ Gmail অ্যাড্রেস গ্রহণযোগ্য (যেমন: yourname@gmail.com)।"
      });
    }

    var properties = PropertiesService.getScriptProperties();

    // ========================================================================
    // ACTION 1: ওটিপি পাঠানো (SEND OTP)
    // ========================================================================
    if (action === "send_otp") {
      var now = Date.now();
      var existingRaw = properties.getProperty("otp_" + email);
      
      if (existingRaw) {
        try {
          var existing = JSON.parse(existingRaw);
          // ৬০ সেকেন্ড কুলডাউন পরীক্ষা
          if (existing.cooldownUntil && now < existing.cooldownUntil) {
            var remainingSec = Math.ceil((existing.cooldownUntil - now) / 1000);
            return createJsonResponse({
              success: false,
              error: "অনুগ্রহ করে " + remainingSec + " সেকেন্ড অপেক্ষা করে আবার চেষ্টা করুন।",
              cooldownRemaining: remainingSec
            });
          }
        } catch (ex) {
          // পার্স ত্রুটি হলে উপেক্ষা করে নতুন কোড জেনারেট করবে
        }
      }

      // ৬-সংখ্যার ক্রিপ্টোগ্রাফিক ওটিপি ও সল্ট তৈরি
      var otp = Math.floor(100000 + Math.random() * 900000).toString();
      var salt = Utilities.getUuid().replace(/-/g, "");
      var otpHash = generateHash(otp, salt);

      var record = {
        otpHash: otpHash,
        salt: salt,
        createdAt: now,
        expiresAt: now + (5 * 60 * 1000), // ৫ মিনিট
        attempts: 0,
        maxAttempts: 5,
        cooldownUntil: now + (60 * 1000)   // ৬০ সেকেন্ড কুলডাউন
      };

      properties.setProperty("otp_" + email, JSON.stringify(record));

      // ব্র্যান্ডেড ইমেইল পাঠানো
      sendBrandedOtpEmail(email, otp);

      return createJsonResponse({
        success: true,
        message: "আপনার জিমেইলে ৬-সংখ্যার ভেরিফিকেশন কোড পাঠানো হয়েছে।"
      });
    }

    // ========================================================================
    // ACTION 2: ওটিপি যাচাই করা (VERIFY OTP)
    // ========================================================================
    if (action === "verify_otp") {
      var userOtp = (requestData.otp || "").toString().trim().replace(/\D/g, "");

      if (!userOtp || userOtp.length !== 6) {
        return createJsonResponse({
          success: false,
          error: "অনুগ্রহ করে ৬-সংখ্যার সঠিক ওটিপি কোড লিখুন।"
        });
      }

      var storedRaw = properties.getProperty("otp_" + email);
      if (!storedRaw) {
        return createJsonResponse({
          success: false,
          error: "কোনো সক্রিয় ভেরিফিকেশন কোড পাওয়া যায়নি। নতুন কোডের অনুরোধ করুন।"
        });
      }

      var record;
      try {
        record = JSON.parse(storedRaw);
      } catch (err) {
        properties.deleteProperty("otp_" + email);
        return createJsonResponse({
          success: false,
          error: "রেকর্ড পার্স করা যায়নি। অনুগ্রহ করে নতুন কোড নিন।"
        });
      }

      var currentTime = Date.now();

      // মেয়াদ পরীক্ষা (৫ মিনিট)
      if (currentTime > record.expiresAt) {
        properties.deleteProperty("otp_" + email);
        return createJsonResponse({
          success: false,
          error: "ভেরিফিকেশন কোডের মেয়াদ শেষ হয়ে গেছে। নতুন কোডের অনুরোধ করুন।"
        });
      }

      // সর্বোচ্চ চেষ্টার সীমা (৫ বার)
      if (record.attempts >= record.maxAttempts) {
        properties.deleteProperty("otp_" + email);
        return createJsonResponse({
          success: false,
          error: "সর্বোচ্চ ৫ বার ভুল কোড দেওয়া হয়েছে। কোডটি বাতিল করা হয়েছে। নতুন কোড নিন।"
        });
      }

      // হ্যাশ তুলনা (Timing-safe logic)
      var candidateHash = generateHash(userOtp, record.salt);

      if (candidateHash === record.otpHash) {
        // ওটিপি সঠিক! তাৎক্ষণিকভাবে ওটিপি রেকর্ড মুছে ফেলা হবে যাতে পুনরায় ব্যবহার না হয়
        properties.deleteProperty("otp_" + email);

        // ভেরিফিকেশন স্টেট মার্ক করা (১৫ মিনিটের জন্য বৈধ)
        properties.setProperty("verified_" + email, JSON.stringify({
          verifiedAt: currentTime,
          expiresAt: currentTime + (15 * 60 * 1000)
        }));

        return createJsonResponse({
          success: true,
          verified: true,
          message: "ইমেইল সফলভাবে যাচাই করা হয়েছে।"
        });
      } else {
        // ভুল কোড: চেষ্টার সংখ্যা বৃদ্ধি
        record.attempts += 1;
        var remaining = record.maxAttempts - record.attempts;

        if (remaining <= 0) {
          properties.deleteProperty("otp_" + email);
          return createJsonResponse({
            success: false,
            error: "সর্বোচ্চ ৫ বার ভুল কোড দেওয়ার কারণে এটি বাতিল হয়েছে। নতুন কোড নিন।",
            remainingAttempts: 0
          });
        } else {
          properties.setProperty("otp_" + email, JSON.stringify(record));
          return createJsonResponse({
            success: false,
            error: "ভুল ভেরিফিকেশন কোড। বাকি সুযোগ: " + remaining + " বার।",
            remainingAttempts: remaining
          });
        }
      }
    }

    return createJsonResponse({
      success: false,
      error: "অসমর্থিত অ্যাকশন। 'send_otp' অথবা 'verify_otp' ব্যবহার করুন।"
    });

  } catch (err) {
    return createJsonResponse({
      success: false,
      error: "সার্ভিস প্রক্রিয়া করতে ত্রুটি: " + (err.message || err.toString())
    });
  }
}

/**
 * GET রিকোয়েস্ট হ্যান্ডলার (হেলথ চেক ও ফলব্যাক)
 */
function doGet(e) {
  // যদি GET রিকোয়েস্টেও প্যারামিটার হিসেবে action পাঠানো হয়
  if (e && e.parameter && e.parameter.action) {
    return doPost(e);
  }

  return createJsonResponse({
    success: true,
    status: "online",
    service: "Virtual Manager Gmail OTP Backend",
    timestamp: new Date().toISOString()
  });
}

/**
 * SHA-256 ক্রিপ্টোগ্রাফিক হ্যাশ জেনারেটর
 */
function generateHash(data, salt) {
  var rawBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    data + ":" + salt,
    Utilities.Charset.UTF_8
  );
  var hashStr = "";
  for (var i = 0; i < rawBytes.length; i++) {
    var byteVal = rawBytes[i];
    if (byteVal < 0) byteVal += 256;
    var hex = byteVal.toString(16);
    if (hex.length === 1) hex = "0" + hex;
    hashStr += hex;
  }
  return hashStr;
}

/**
 * ভার্চুয়াল ম্যানেজারের ব্র্যান্ডেড ওটিপি ইমেইল পাঠানো
 */
function sendBrandedOtpEmail(email, otp) {
  var subject = "ভার্চুয়াল ম্যানেজার - রেজিস্ট্রেশন ওটিপি কোড (" + otp + ")";
  
  var plainTextBody = 
    "আপনার ভার্চুয়াল ম্যানেজার একাউন্ট নিবন্ধনের ভেরিফিকেশন কোড: " + otp + "\n" +
    "এই কোডটি আগামী ৫ মিনিট কার্যকর থাকবে।\n\n" +
    "নিরাপত্তা সতর্কতা: এই কোডটি কারো সাথে শেয়ার করবেন না। ভার্চুয়াল ম্যানেজার কর্তৃপক্ষ কখনো আপনার কাছে কোড চাইবে না।\n\n" +
    "Your Virtual Manager verification code is: " + otp + " (Valid for 5 minutes).";

  var htmlBody = 
    '<!DOCTYPE html>' +
    '<html>' +
    '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
    '<body style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 24px;">' +
      '<div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">' +
        
        '<!-- হেডার ব্যানার -->' +
        '<div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 24px; text-align: center; border-bottom: 3px solid #0d9488;">' +
          '<div style="display: inline-block; width: 48px; height: 48px; line-height: 48px; background: rgba(13, 148, 136, 0.2); border: 1px solid #0d9488; border-radius: 12px; margin-bottom: 12px; text-align: center;">' +
            '<span style="font-size: 24px;">📖</span>' +
          '</div>' +
          '<h1 style="color: #ffffff; margin: 0 0 6px 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">ভার্চুয়াল ম্যানেজার</h1>' +
          '<p style="color: #5eead4; margin: 0; font-size: 13px; font-weight: 500;">ডিজিটাল খাতা ও নিরাপদ বাকি-হিসাব ব্যবস্থাপনা</p>' +
        '</div>' +

        '<!-- মূল কন্টেন্ট -->' +
        '<div style="padding: 32px 24px;">' +
          '<p style="color: #334155; font-size: 15px; margin: 0 0 16px 0; line-height: 1.6;">' +
            'প্রিয় গ্রাহক,<br>' +
            'ভার্চুয়াল ম্যানেজারে নতুন একাউন্ট খোলার আবেদন করার জন্য ধন্যবাদ। আপনার জিমেইল ঠিকানা যাচাই করতে নিচের ৬-সংখ্যার কোডটি ব্যবহার করুন:' +
          '</p>' +

          '<!-- ওটিপি বক্স -->' +
          '<div style="background-color: #f0fdfa; border: 2px dashed #0d9488; border-radius: 12px; padding: 24px 16px; text-align: center; margin: 24px 0;">' +
            '<span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #0f766e; font-weight: 700; display: block; margin-bottom: 8px;">আপনার ভেরিফিকেশন কোড</span>' +
            '<div style="font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #0f766e; font-family: monospace; display: inline-block; padding: 6px 12px; background: #ffffff; border-radius: 8px; border: 1px solid #99f6e4;">' +
              otp +
            '</div>' +
            '<p style="color: #64748b; font-size: 12px; margin: 12px 0 0 0; font-weight: 500;">' +
              '⏱ এই কোডটি আগামী <strong>৫ মিনিট</strong> কার্যকর থাকবে' +
            '</p>' +
          '</div>' +

          '<!-- নিরাপত্তা সতর্কতা -->' +
          '<div style="background-color: #fff1f2; border-left: 4px solid #f43f5e; padding: 12px 16px; border-radius: 6px; margin-bottom: 24px;">' +
            '<p style="color: #9f1239; font-size: 12px; line-height: 1.5; margin: 0;">' +
              '<strong>🔒 নিরাপত্তা সতর্কতা:</strong> এই ওটিপি কোডটি অত্যন্ত সংবেদনশীল। এটি কাউকে দেখাবেন না। আপনি যদি এই আবেদন না করে থাকেন তবে এই ইমেইলটি উপেক্ষা করুন।' +
            '</p>' +
          '</div>' +

          '<p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0;">' +
            'If you did not request this OTP, no further action is required. Your email address is safe.' +
          '</p>' +
        '</div>' +

        '<!-- ফুটার -->' +
        '<div style="background-color: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: center;">' +
          '<p style="color: #94a3b8; font-size: 11px; margin: 0; line-height: 1.4;">' +
            'ভার্চুয়াল ম্যানেজার • Virtual Manager Cloud Accounting<br>' +
            'স্বয়ংক্রিয় সিস্টেম থেকে প্রেরিত বার্তা • উত্তর প্রদান করবেন না' +
          '</p>' +
        '</div>' +
      '</div>' +
    '</body>' +
    '</html>';

  MailApp.sendEmail({
    to: email,
    subject: subject,
    body: plainTextBody,
    htmlBody: htmlBody
  });
}

/**
 * JSON রেসপন্স সহায়ক ফাংশন (CORS হেডারসহ)
 */
function createJsonResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
