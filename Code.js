// ===== Utility Functions =====
function getSheet(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }

function gradeToPoint(grade) { 
  const map={"A":4,"B+":3.5,"B":3,"C+":2.5,"C":2,"D":1.5,"F":0}; 
  return map[grade]||0; 
}

// ===== Student CRUD (Update Target/Password) =====
function updateStudentProfile(studentID, newName, newEmail, newPassword, newTargetGPA) {
  const sheet = getSheet("Students");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === studentID) {
      const row = i + 1;
      sheet.getRange(row, headers.indexOf("Name") + 1).setValue(newName);
      sheet.getRange(row, headers.indexOf("Email") + 1).setValue(newEmail);
      if (newPassword) sheet.getRange(row, headers.indexOf("Password") + 1).setValue(newPassword);
      sheet.getRange(row, headers.indexOf("TargetGPA") + 1).setValue(parseFloat(newTargetGPA));
      
      return getStudentInfo(studentID);
    }
  }
  return { status: "error", msg: "Student not found!" };
}

// ===== Course CRUD =====
function addCourse(studentID, semester, courseName, credits, grade) {
  const sheet = getSheet("Courses");
  const rowID = Utilities.getUuid();
  sheet.appendRow([studentID, semester, courseName, Number(credits), grade, rowID]);
  return getStudentInfo(studentID);
}

function updateCourse(studentID, rowID, semester, courseName, credits, grade) {
  const sheet = getSheet("Courses");
  const data = sheet.getDataRange().getValues();
  const rowIDIndex = data[0].indexOf("RowID");

  for (let i = 1; i < data.length; i++) {
    if (data[i][rowIDIndex] === rowID && data[i][0] === studentID) {
      const row = i + 1;
      sheet.getRange(row, 2).setValue(semester);
      sheet.getRange(row, 3).setValue(courseName);
      sheet.getRange(row, 4).setValue(Number(credits));
      sheet.getRange(row, 5).setValue(grade);
      return getStudentInfo(studentID);
    }
  }
  return { status: "error", msg: "Course not found or access denied." };
}

function deleteCourse(studentID, rowID) {
  const sheet = getSheet("Courses");
  const data = sheet.getDataRange().getValues();
  const rowIDIndex = data[0].indexOf("RowID");

  for (let i = 1; i < data.length; i++) {
    if (data[i][rowIDIndex] === rowID && data[i][0] === studentID) {
      sheet.deleteRow(i + 1);
      return getStudentInfo(studentID);
    }
  }
  return { status: "error", msg: "Course not found or access denied." };
}

// ===== GPA & Metric Calculation (Simplified for brevity, same logic as before) =====
function calculateMetrics(studentID, targetGPA, totalRequiredCredits, allCourses) {
  let earnedCredits = 0;
  let totalQualityPoints = 0;
  let gradeCounts = {};

  allCourses.forEach(r => { 
    const credits = Number(r.Credits);
    const points = gradeToPoint(r.Grade);
    
    if (credits > 0) {
      earnedCredits += credits;
      totalQualityPoints += points * credits;
      
      const gradeKey = r.Grade === 'A' || r.Grade === 'B+' || r.Grade === 'B' ? r.Grade : 'Other';
      gradeCounts[gradeKey] = (gradeCounts[gradeKey] || 0) + 1;
    }
  });

  const gpa = earnedCredits ? (totalQualityPoints / earnedCredits).toFixed(2) : 0;
  const remainingCredits = Math.max(0, totalRequiredCredits - earnedCredits);

  const requiredQualityPoints = (targetGPA * totalRequiredCredits) - (gpa * earnedCredits);
  let requiredGPA = 0;

  if (remainingCredits > 0) {
    requiredGPA = Math.max(0, (requiredQualityPoints / remainingCredits)).toFixed(2);
  }

  return { gpa, earnedCredits, remainingCredits, totalRequiredCredits, gradeCounts, requiredGPA };
}


// ===== Get Student Info (The Hub) =====
function getStudentInfo(studentID) {
  const sSheet = getSheet("Students");
  const sRows = sSheet.getDataRange().getValues();
  const sHeaders = sRows[0];
  const sRow = sRows.find((r, i) => i > 0 && r[0] === studentID);
  
  if (!sRow) return null;
  
  const student = Object.fromEntries(sHeaders.map((h, i) => [h, sRow[i]]));
  const targetGPA = parseFloat(student.TargetGPA);
  const totalRequiredCredits = parseInt(student.TotalRequiredCredits || 120);

  const cSheet = getSheet("Courses");
  const cData = cSheet.getDataRange().getValues();
  const cHeaders = cData[0];
  
  const courses = cData.slice(1)
    .filter(r => r[0] === studentID)
    .map(r => Object.fromEntries(cHeaders.map((h, i) => [h, r[i]])));
  
  const metrics = calculateMetrics(studentID, targetGPA, totalRequiredCredits, courses);

  return { 
    status: "success", 
    student, 
    courses, 
    targetGPA, 
    ...metrics 
  };
}

// ===== Get Opportunities (No Change) =====
function getOpportunities(){
  const sheet=getSheet("Opportunities");
  const data=sheet.getDataRange().getValues().slice(1);
  return data.map(r=>({ID:r[0],Title:r[1],Type:r[2],Description:r[3],Link:r[4]}));
}

// ===== Login/Logout/Web App Handlers =====
function loginStudent(studentID, password) {
  const sheet = getSheet("Students");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const rowID = data[i][0].toString().trim();
    const rowPass = data[i][3].toString().trim();
    if (rowID === studentID && rowPass === password) {
      return getStudentInfo(studentID);
    }
  }
  return { status: "error", msg: "Invalid ID or password!" };
}

function registerStudent(studentID, name, email, password, targetGPA, totalRequiredCredits = 120) {
    const sheet = getSheet("Students");
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) { if (data[i][0] === studentID) return { status: "error", msg: "Student ID exists!" }; }
    sheet.appendRow([studentID, name, email, password, parseFloat(targetGPA), totalRequiredCredits]);
    return { status: "success", msg: "Registered successfully!" };
}


function doGet() { 
  return HtmlService.createTemplateFromFile("Index").evaluate().setTitle("University Student Portal"); 
}

function include(filename) { 
  return HtmlService.createHtmlOutputFromFile(filename).getContent(); 
}
