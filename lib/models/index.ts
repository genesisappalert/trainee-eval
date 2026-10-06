import mongoose, { Schema, Document, Model } from 'mongoose';

/* ============================================================
   User Model — Supervisors, HR Admins, HR Viewers
   PRD Section 10: users collection
   ============================================================ */

export interface IUser extends Document {
  staffId: string;
  name: string;
  email: string;
  department: string;
  location: string;
  roles: ('supervisor' | 'hr_admin' | 'hr_viewer')[];
  accessCode?: string | null;
  passwordHash: string;
  mustChangePassword: boolean;
  failedLogins: number;
  lockedUntil: Date | null;
  savedSignatureKey: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    staffId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    department: { type: String, required: true },
    location: { type: String, required: true },
    roles: {
      type: [{ type: String, enum: ['supervisor', 'hr_admin', 'hr_viewer'] }],
      required: true,
      default: ['supervisor'],
    },
    accessCode: { type: String, default: null, index: true },
    passwordHash: { type: String, default: '' },
    mustChangePassword: { type: Boolean, default: false },
    failedLogins: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    savedSignatureKey: { type: String, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

/* ============================================================
   Cycle Model — One appraisal round
   PRD Section 10: cycles collection
   ============================================================ */

export type CycleStatus = 'draft' | 'open' | 'closed' | 'archived';

export interface ICycle extends Document {
  slug: string;
  name: string;
  cohort: string;
  status: CycleStatus;
  opensAt: Date;
  traineeDeadline: Date;
  supervisorDeadline: Date;
  traineeFormVersionId: mongoose.Types.ObjectId;
  supervisorFormVersionId: mongoose.Types.ObjectId;
  supervisorIds: mongoose.Types.ObjectId[];
  resultsReleased: boolean;
  reminderPolicy: {
    enabled: boolean;
    daysBeforeDeadline: number[];
    daysWhileOverdue: number;
  };
  printConfidentialOnHrCopy: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CycleSchema = new Schema<ICycle>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    cohort: { type: String, required: true },
    status: {
      type: String,
      enum: ['draft', 'open', 'closed', 'archived'],
      default: 'draft',
    },
    opensAt: { type: Date, required: true },
    traineeDeadline: { type: Date, required: true },
    supervisorDeadline: { type: Date, required: true },
    traineeFormVersionId: { type: Schema.Types.ObjectId, ref: 'FormVersion', required: true },
    supervisorFormVersionId: { type: Schema.Types.ObjectId, ref: 'FormVersion', required: true },
    supervisorIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    resultsReleased: { type: Boolean, default: false },
    reminderPolicy: {
      enabled: { type: Boolean, default: false },
      daysBeforeDeadline: [{ type: Number }],
      daysWhileOverdue: { type: Number, default: 3 },
    },
    printConfidentialOnHrCopy: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Cycle: Model<ICycle> =
  mongoose.models.Cycle || mongoose.model<ICycle>('Cycle', CycleSchema);

/* ============================================================
   Roster Entry Model — Expected trainees per cycle (optional)
   PRD Section 10: rosterEntries collection
   ============================================================ */

export interface IRosterEntry extends Document {
  cycleId: mongoose.Types.ObjectId;
  staffId: string;
  name: string;
  email: string;
  department: string;
  location: string;
  expectedSupervisorId: mongoose.Types.ObjectId | null;
  appraisalId: mongoose.Types.ObjectId | null;
}

const RosterEntrySchema = new Schema<IRosterEntry>(
  {
    cycleId: { type: Schema.Types.ObjectId, ref: 'Cycle', required: true, index: true },
    staffId: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    department: { type: String, default: '' },
    location: { type: String, default: '' },
    expectedSupervisorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    appraisalId: { type: Schema.Types.ObjectId, ref: 'Appraisal', default: null },
  },
  { timestamps: true }
);

RosterEntrySchema.index({ cycleId: 1, staffId: 1 });

export const RosterEntry: Model<IRosterEntry> =
  mongoose.models.RosterEntry || mongoose.model<IRosterEntry>('RosterEntry', RosterEntrySchema);

/* ============================================================
   Appraisal Model — The paired record
   PRD Section 10: appraisals collection
   ============================================================ */

export type AppraisalStatus =
  | 'not_started'
  | 'trainee_draft'
  | 'awaiting_supervisor'
  | 'needs_reassignment'
  | 'supervisor_draft'
  | 'complete'
  | 'reopened'
  | 'printed'
  | 'archived';

export type AppraisalFlag =
  | 'unmatched'
  | 'duplicate'
  | 'needs_reassignment'
  | 'unassigned'
  | 'page_overflow';

export interface IAppraisal extends Document {
  cycleId: mongoose.Types.ObjectId;
  traineeStaffId: string;
  traineeName: string;
  traineeEmail: string;
  department: string;
  location: string;
  supervisorId: mongoose.Types.ObjectId | null;
  status: AppraisalStatus;
  flags: AppraisalFlag[];
  rosterEntryId: mongoose.Types.ObjectId | null;
  traineeSheetId: mongoose.Types.ObjectId | null;
  supervisorSheetId: mongoose.Types.ObjectId | null;
  releaseWithheld: boolean;
  traineeSubmittedAt: Date | null;
  supervisorSubmittedAt: Date | null;
  printedAt: Date | null;
  voidedAt: Date | null;
  voidReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const AppraisalSchema = new Schema<IAppraisal>(
  {
    cycleId: { type: Schema.Types.ObjectId, ref: 'Cycle', required: true, index: true },
    traineeStaffId: { type: String, required: true },
    traineeName: { type: String, required: true },
    traineeEmail: { type: String, default: '' },
    department: { type: String, default: '' },
    location: { type: String, default: '' },
    supervisorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    status: {
      type: String,
      enum: [
        'not_started', 'trainee_draft', 'awaiting_supervisor',
        'needs_reassignment', 'supervisor_draft', 'complete',
        'reopened', 'printed', 'archived',
      ],
      default: 'trainee_draft',
    },
    flags: [{
      type: String,
      enum: ['unmatched', 'duplicate', 'needs_reassignment', 'unassigned', 'page_overflow'],
    }],
    rosterEntryId: { type: Schema.Types.ObjectId, ref: 'RosterEntry', default: null },
    traineeSheetId: { type: Schema.Types.ObjectId, ref: 'TraineeSheet', default: null },
    supervisorSheetId: { type: Schema.Types.ObjectId, ref: 'SupervisorSheet', default: null },
    releaseWithheld: { type: Boolean, default: false },
    traineeSubmittedAt: { type: Date, default: null },
    supervisorSubmittedAt: { type: Date, default: null },
    printedAt: { type: Date, default: null },
    voidedAt: { type: Date, default: null },
    voidReason: { type: String, default: null },
  },
  { timestamps: true }
);

AppraisalSchema.index({ cycleId: 1, traineeStaffId: 1 });
AppraisalSchema.index({ cycleId: 1, supervisorId: 1, status: 1 });

export const Appraisal: Model<IAppraisal> =
  mongoose.models.Appraisal || mongoose.model<IAppraisal>('Appraisal', AppraisalSchema);

/* ============================================================
   Trainee Sheet Model — Trainee answers
   PRD Section 10: traineeSheets collection
   ============================================================ */

export type SheetStatus = 'draft' | 'submitted' | 'reopened';

export interface ITraineeSheet extends Document {
  appraisalId: mongoose.Types.ObjectId;
  formVersionId: mongoose.Types.ObjectId;
  answers: Record<string, string | number>;
  signatureKey: string | null;
  signedAt: Date | null;
  status: SheetStatus;
  submittedAt: Date | null;
  submitIp: string | null;
  userAgent: string | null;
  tokenHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const TraineeSheetSchema = new Schema<ITraineeSheet>(
  {
    appraisalId: { type: Schema.Types.ObjectId, ref: 'Appraisal', required: true, index: true },
    formVersionId: { type: Schema.Types.ObjectId, ref: 'FormVersion', required: true },
    answers: { type: Schema.Types.Mixed, default: {} },
    signatureKey: { type: String, default: null },
    signedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'reopened'],
      default: 'draft',
    },
    submittedAt: { type: Date, default: null },
    submitIp: { type: String, default: null },
    userAgent: { type: String, default: null },
    tokenHash: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

export const TraineeSheet: Model<ITraineeSheet> =
  mongoose.models.TraineeSheet || mongoose.model<ITraineeSheet>('TraineeSheet', TraineeSheetSchema);

/* ============================================================
   Supervisor Sheet Model — Supervisor answers
   PRD Section 10: supervisorSheets collection
   ============================================================ */

export interface ISupervisorSheet extends Document {
  appraisalId: mongoose.Types.ObjectId;
  supervisorId: mongoose.Types.ObjectId;
  formVersionId: mongoose.Types.ObjectId;
  answers: Record<string, string | number>;
  signatureKey: string | null;
  signedAt: Date | null;
  status: SheetStatus;
  submittedAt: Date | null;
  submitIp: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const SupervisorSheetSchema = new Schema<ISupervisorSheet>(
  {
    appraisalId: { type: Schema.Types.ObjectId, ref: 'Appraisal', required: true, index: true },
    supervisorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    formVersionId: { type: Schema.Types.ObjectId, ref: 'FormVersion', required: true },
    answers: { type: Schema.Types.Mixed, default: {} },
    signatureKey: { type: String, default: null },
    signedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'reopened'],
      default: 'draft',
    },
    submittedAt: { type: Date, default: null },
    submitIp: { type: String, default: null },
  },
  { timestamps: true }
);

export const SupervisorSheet: Model<ISupervisorSheet> =
  mongoose.models.SupervisorSheet || mongoose.model<ISupervisorSheet>('SupervisorSheet', SupervisorSheetSchema);

/* ============================================================
   Form Version Model — Form definitions
   PRD Section 10: formVersions collection
   ============================================================ */

export type FieldType = 'text' | 'email' | 'rating' | 'comment' | 'longtext' | 'select' | 'overall' | 'signature' | 'auto';

export interface IFormField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  maxLength?: number;
  options?: { value: string; label: string }[];
  confidential: boolean;
  placeholder?: string;
  helperText?: string;
  linkedTo?: string; // e.g., comment field linked to a rating field
}

export interface IFormVersion extends Document {
  kind: 'trainee' | 'supervisor';
  version: string;
  title: string;
  purpose: string;
  ratingScale: { value: number; label: string; description?: string }[];
  fields: IFormField[];
  templateVersionId: mongoose.Types.ObjectId | null;
  active: boolean;
  createdAt: Date;
}

const FormFieldSchema = new Schema<IFormField>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    type: {
      type: String,
      enum: ['text', 'email', 'rating', 'comment', 'longtext', 'select', 'overall', 'signature', 'auto'],
      required: true,
    },
    required: { type: Boolean, default: false },
    maxLength: { type: Number },
    options: [{
      value: { type: String },
      label: { type: String },
    }],
    confidential: { type: Boolean, default: false },
    placeholder: { type: String },
    helperText: { type: String },
    linkedTo: { type: String },
  },
  { _id: false }
);

const FormVersionSchema = new Schema<IFormVersion>(
  {
    kind: { type: String, enum: ['trainee', 'supervisor'], required: true },
    version: { type: String, required: true },
    title: { type: String, required: true },
    purpose: { type: String, required: true },
    ratingScale: [{
      value: { type: Number, required: true },
      label: { type: String, required: true },
      description: { type: String },
    }],
    fields: [FormFieldSchema],
    templateVersionId: { type: Schema.Types.ObjectId, ref: 'TemplateVersion', default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

FormVersionSchema.index({ kind: 1, version: 1 }, { unique: true });

export const FormVersion: Model<IFormVersion> =
  mongoose.models.FormVersion || mongoose.model<IFormVersion>('FormVersion', FormVersionSchema);

/* ============================================================
   Audit Log Model — Append-only trail
   PRD Section 10: auditLogs collection
   ============================================================ */

export interface IAuditLog extends Document {
  at: Date;
  actorType?: 'trainee' | 'user' | 'system';
  actorId?: any;
  actorRole?: string;
  ip?: string;
  action: string;
  entity?: string;
  entityId?: string;
  targetType?: string;
  targetId?: string;
  cycleId?: mongoose.Types.ObjectId | null;
  metadata?: Record<string, unknown>;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    at: { type: Date, default: Date.now, index: true },
    actorType: { type: String, enum: ['trainee', 'user', 'system'], default: 'user' },
    actorId: { type: Schema.Types.Mixed, default: null },
    actorRole: { type: String, default: 'system' },
    ip: { type: String, default: '' },
    action: { type: String, required: true, index: true },
    entity: { type: String, default: '' },
    entityId: { type: String, default: '' },
    targetType: { type: String, default: '' },
    targetId: { type: String, default: '' },
    cycleId: { type: Schema.Types.ObjectId, ref: 'Cycle', default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    reason: { type: String },
  },
  {
    timestamps: true,
  }
);

AuditLogSchema.index({ entity: 1, entityId: 1 });

export const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

/* ============================================================
   Notification Model — Email log
   PRD Section 10: notifications collection
   ============================================================ */

export interface INotification extends Document {
  to: string;
  template: string;
  appraisalId: mongoose.Types.ObjectId | null;
  status: 'pending' | 'sent' | 'failed';
  providerMessageId: string | null;
  sentAt: Date | null;
  error: string | null;
}

const NotificationSchema = new Schema<INotification>(
  {
    to: { type: String, required: true },
    template: { type: String, required: true },
    appraisalId: { type: Schema.Types.ObjectId, ref: 'Appraisal', default: null },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    providerMessageId: { type: String, default: null },
    sentAt: { type: Date, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

export const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);
