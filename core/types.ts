
export type UserRole = 'student' | 'admin';
export type AdminPermission = 'super_admin' | 'institution_admin' | 'viewer';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  institution: string;
  phoneNumber?: string;
  role: UserRole;
  level?: string;
  program?: string;
  isBlocked?: boolean;
  currentSessionId?: string;
  createdAt: number;
  membershipStatus?: 'active' | 'pending';
  paid?: boolean; // For backward compatibility with older profile structures
  // Admin-specific fields
  adminPermission?: AdminPermission;
  assignedInstitutions?: string[];
  lastActiveAt?: number;
}

export interface MembershipLevelSettings {
  paymentRequired: boolean;
  price: number;
}

export interface MembershipSettings {
  form1: MembershipLevelSettings;
  form2: MembershipLevelSettings;
  form3: MembershipLevelSettings;
  candidate: MembershipLevelSettings;
}

export interface PaymentRecord {
  id?: string;
  email: string;
  formLevel: string;
  amount: number;
  status: 'success' | 'pending' | 'failed';
  reference: string;
  userId?: string;
  createdAt: number;
}

export interface AdminLog {
  id: string;
  adminUid: string;
  adminName: string;
  action: string;
  details: string;
  level?: string;
  timestamp: number;
}

export interface Quiz {
  id: string;
  subjectTitle?: string;
  title: string;
  description: string;
  allowedPrograms?: string[];
  timeLimit: number; // minutes
  totalQuestions: number;
  published: boolean;
  createdBy: string;
  createdAt: number;
  // Added to support dynamic question option counts (2, 3, 4)
  defaultOptionsCount: number;
  quizCode?: string;
  lockCode?: string;
  restrictScreenshot?: boolean;
  restrictCopyPaste?: boolean;
  restrictTabSwitch?: boolean;
  enforceFullscreen?: boolean;
  disableTextSelection?: boolean;
  disableRightClick?: boolean;
  watermarkEnabled?: boolean;
  movingWatermark?: boolean;
  blurOnTabLeave?: boolean;
  minSubmissionPercentage?: number;
  defaultMarkPerQuestion?: number;
  restrictQuestionPrinting?: boolean;
  restrictResultPrinting?: boolean;

  // Live Controls & Monitor additions
  status?: 'active' | 'paused' | 'completed' | 'draft';
  showResults?: boolean;
  announcement?: string;
  allowedUsers?: string[]; // student emails/IDs
  availableFrom?: number;
  availableUntil?: number;
  institution?: string;
  level?: string;
  questionsPerPage?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
}

export interface Question {
  id: string;
  quizId: string;
  text: string;
  options: string[];
  correctOptionIndex: number;
  order?: number;
  mark?: number;
}

export interface Submission {
  id: string;
  quizId: string;
  studentId: string;
  studentName: string;
  sessionId?: string;
  score: number;
  totalPossible: number;
  startedAt: number;
  completedAt: number;
  answers: Record<string, number>; // questionId -> selectedIndex
  status: 'active' | 'completed';
  violations?: number;
  lastViolationAt?: number;
  createdAt: number;

  // Live session additions
  timeExtension?: number; // extra minutes
  lastActive?: number; // presence timestamp
  currentQuestionIndex?: number; // progress
  isAdminGraded?: boolean;
  scoreOverride?: number;
  isIncompleteAttempt?: boolean;
  stoppedByAdmin?: boolean;
  correctCount?: number;
  totalQuestions?: number;
  studentLevel?: string;
  studentInstitution?: string;
}

export interface LibraryResource {
  id: string;
  title: string;
  description?: string;
  level: string; // '100' | '200' | '300' | 'candidate'
  fileUrl: string; // Firebase Storage download URL (PDF)
  thumbnailUrl?: string; // Optional cover image URL
  fileName: string; // Original filename
  fileSize?: number; // bytes
  uploadedBy: string; // Admin UID
  uploadedByName?: string; // Admin display name
  uploadedAt: any; // Firestore serverTimestamp
  published: boolean;
}

