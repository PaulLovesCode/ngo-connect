import { Timestamp } from 'firebase/firestore';

export type Urgency = 'low' | 'medium' | 'high' | 'critical';
export type EmergencyStatus = 'pending' | 'assigned' | 'resolved';
export type TaskStatus = 'open' | 'in-progress' | 'completed';
export type UserRole = 'volunteer' | 'admin';

export interface Volunteer {
  uid: string;
  name: string;
  email: string;
  skills: string[];
  role: UserRole;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  age?: number;
  address?: string;
  mobile?: string;
  yearsVolunteering?: number;
  photoURL?: string;
}

export interface Emergency {
  id: string;
  reporterUid: string;
  reporterName: string;
  description: string;
  location: string;
  urgency: Urgency;
  status: EmergencyStatus;
  requiredSkills: string[];
  createdAt: Timestamp;
  processedByAi?: boolean;
}

export interface Task {
  id: string;
  emergencyId: string;
  assignedVolunteerUid: string;
  status: TaskStatus;
  createdAt: Timestamp;
}
