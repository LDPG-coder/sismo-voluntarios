export type Activity = {
  id: string;
  title: string;
  description: string | null;
  zone: string;
  raw_address: string;
  date_time: string;
  end_time: string | null;
  estimated_duration_min: number | null;
  max_participants: number | null;
  requirements: string | null;
  contact_info: string | null;
  is_internal?: boolean;
  is_private?: boolean;
  is_demo?: boolean;
  demo_until?: string | null;
  creator_id: string;
  status: string;
  member_count: number;
  my_attended?: boolean | null;
  creator?: {
    id: string;
    name: string | null;
    photo_url: string | null;
    phone: string | null;
  };
};

export type ActivityEvidence = {
  id: string;
  image_url: string;
  uploaded_by: string;
  uploader_name: string | null;
  created_at: string | null;
};