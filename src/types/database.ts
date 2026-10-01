// Mirrors supabase/schema.sql. Keep the two in sync.

export type UserRole = "super_admin" | "staff" | "room_staff" | "executive" | "user";
export type TicketStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type UrgencyLevel = "low" | "medium" | "high" | "emergency";
export type ApprovalMode = "paper_hybrid" | "digital_multistage";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "revision_requested";
export type ModuleType = "repair" | "reservation" | "environment" | "general_memo";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  position: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Building {
  id: string;
  code: string;
  name: string;
  floor_count: number;
  is_active: boolean;
  created_at: string;
}

export interface Room {
  id: string;
  building_id: string;
  room_number: string;
  name: string;
  capacity: number | null;
  is_bookable: boolean;
  requires_approval: boolean | null;
  equipment: string[] | null;
  created_at: string;
}

export interface FacilityReservation {
  id: string;
  reservation_number: string;
  applicant_id: string;
  room_id: string;
  start_time: string;
  end_time: string;
  purpose: string;
  attendee_count: number | null;
  equipment_needed: string | null;
  status: ApprovalStatus;
  created_at: string;
}

export interface RepairTicket {
  id: string;
  ticket_number: string;
  reporter_id: string;
  building_id: string;
  room_id: string | null;
  location_detail: string | null;
  title: string;
  description: string;
  urgency: UrgencyLevel;
  status: TicketStatus;
  image_urls: string[];
  estimated_cost: number;
  technician_notes: string | null;
  /** Set when this report repeats another open ticket; status then follows that ticket. */
  duplicate_of?: string | null;
  duplicate_of_number?: string | null;
  created_at: string;
  updated_at: string;
}

/** A ticket with its building and room resolved, as the dashboard queries it. */
export type RepairTicketWithLocation = RepairTicket & {
  building: Pick<Building, "name"> | null;
  room: Pick<Room, "room_number" | "name"> | null;
};

export interface Memorandum {
  id: string;
  doc_ref_no: string;
  origin_module: ModuleType;
  reference_id: string | null;
  author_id: string;
  subject: string;
  recipient: string;
  body_content: string;
  proposal: string | null;
  approval_mode: ApprovalMode;
  current_step: number;
  final_status: ApprovalStatus;
  created_at: string;
  updated_at: string;
}

export type NewRepairTicket = Pick<
  RepairTicket,
  "building_id" | "title" | "description" | "urgency"
> & { location_detail?: string | null };
