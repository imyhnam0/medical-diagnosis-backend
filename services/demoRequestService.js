import { db } from "../server.js";
import admin from "firebase-admin";

/**
 * 데모 요청 이메일을 Firestore에 저장
 * demo/email 문서에 이메일과 타임스탬프를 저장
 */
export async function saveDemoRequest(req, res) {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: "이메일 주소가 필요합니다." 
      });
    }

    // 이메일 유효성 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ 
        success: false, 
        error: "올바른 이메일 주소를 입력해주세요." 
      });
    }

    const emailRef = db.collection("demo").doc("email");
    
    // 문서가 이미 존재하는지 확인하고 업데이트
    const docSnapshot = await emailRef.get();
    
    // 배열 안에서는 serverTimestamp()를 사용할 수 없으므로 일반 Date 객체 사용
    const now = new Date();
    const newEmailEntry = {
      email: email.trim(),
      requestedAt: now.toISOString(),
      timestamp: admin.firestore.Timestamp.fromDate(now)
    };
    
    if (docSnapshot.exists) {
      // 기존 문서에 emails 배열이 있으면 추가, 없으면 생성
      const existingData = docSnapshot.data();
      
      if (existingData.emails && Array.isArray(existingData.emails)) {
        // 중복 체크
        const emailExists = existingData.emails.some(
          e => e && e.email === email.trim()
        );
        
        if (emailExists) {
          return res.status(200).json({ 
            success: true, 
            message: "이미 등록된 이메일입니다." 
          });
        }
        
        // 배열을 읽어서 새 항목을 추가한 후 전체 배열을 업데이트
        const updatedEmails = [...existingData.emails, newEmailEntry];
        await emailRef.update({
          emails: updatedEmails
        });
      } else {
        // emails 배열이 없으면 새로 생성
        await emailRef.update({
          emails: [newEmailEntry]
        });
      }
    } else {
      // 문서가 없으면 새로 생성
      await emailRef.set({
        emails: [newEmailEntry]
      });
    }

    console.log(`✅ 데모 요청 이메일 저장 완료: ${email.trim()}`);
    
    res.status(200).json({ 
      success: true, 
      message: "데모 요청이 성공적으로 저장되었습니다." 
    });

  } catch (error) {
    console.error("❌ 데모 요청 저장 오류:", error);
    res.status(500).json({ 
      success: false, 
      error: "서버 오류가 발생했습니다." 
    });
  }
}

