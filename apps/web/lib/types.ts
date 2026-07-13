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