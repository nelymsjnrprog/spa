import { jsPDF } from 'jspdf';
import { UserProfile } from '../core/types';

export const generateStudentInfoPDF = (student: UserProfile) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header - Premium look
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('SMARTPREP ACADEMY', 20, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('OFFICIAL STUDENT INFORMATION RECORD', 20, 32);
  
  // Profile Section
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Candidate Profile', 20, 60);
  
  // Divider
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(20, 65, pageWidth - 20, 65);
  
  // Details Grid
  const startY = 75;
  const lineHeight = 12;
  const labelX = 20;
  const valueX = 70;
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-400
  
  const fields = [
    { label: 'FULL NAME', value: student.displayName || 'Not Provided' },
    { label: 'EMAIL ADDRESS', value: student.email || 'Not Provided' },
    { label: 'PHONE NUMBER', value: student.phoneNumber || 'Not Provided' },
    { label: 'INSTITUTION', value: student.institution || 'Not Provided' },
    { label: 'ACADEMIC PROGRAM', value: student.program || 'Not Provided' },
    { label: 'CURRENT LEVEL', value: `Level ${student.level || '100'}` },
    { label: 'DATE JOINED', value: student.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'Legacy Record' },
    { label: 'REGISTRY STATUS', value: student.isBlocked ? 'BLOCKED' : 'ACTIVE' },
  ];
  
  fields.forEach((field, index) => {
    const y = startY + (index * lineHeight);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(field.label, labelX, y);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(field.value, valueX, y);
  });
  
  // Footer
  const footerY = 280;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-300
  doc.text(`Generated on ${new Date().toLocaleString()} | Reference UID: ${student.uid}`, 20, footerY);
  doc.text('Confidential Administrative Document', pageWidth - 20, footerY, { align: 'right' });
  
  // Watermark
  doc.setGState(new (doc as any).GState({ opacity: 0.05 }));
  doc.setFontSize(60);
  doc.setTextColor(15, 23, 42);
  doc.text('SMARTPREP', pageWidth / 2, 150, { align: 'center', angle: 45 });
  
  // Save/Show
  doc.save(`${student.displayName?.replace(/\s+/g, '_')}_Profile.pdf`);
};
