export type UserRole = "super_admin" | "staff" | "user";
export type TicketStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type UrgencyLevel = "low" | "medium" | "high" | "emergency";
export type RepairCategory =
  | "electrical"
  | "plumbing"
  | "building_structure"
  | "furniture_equipment"
  | "environment_grounds"
  | "other";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface RepairTicket {
  id: string;
  ticket_number: string;
  reporter_id: string;
  title: string;
  description: string;
  category: RepairCategory;
  location_building: string;
  location_room: string | null;
  urgency: UrgencyLevel;
  status: TicketStatus;
  image_urls: string[];
  technician_notes: string | null;
  estimated_cost: number;
  document_ref_no: string | null;
  created_at: string;
  updated_at: string;
}

export type NewRepairTicket = Pick<
  RepairTicket,
  "title" | "description" | "category" | "location_building" | "urgency"
> & { location_room?: string | null };
