export interface Participant {
  id: string;
  name: string;
  role: string;
  speakingPercentage?: number;
  avatarColor: string;
}

export interface TranscriptSegment {
  id: string;
  speakerId: string;
  speakerName: string;
  timestamp: string; // e.g. "00:01:23"
  seconds: number;
  text: string;
  topic?: string;
}

export interface ActionItem {
  id: string;
  task: string;
  assignee: string;
  priority: 'Alta' | 'Media' | 'Baja';
  deadline: string;
  status: 'pendiente' | 'completada';
}

export interface ExecutiveSummary {
  objective: string;
  keyPoints: string[];
  decisions: string[];
  sentiment?: string;
}

export interface MeetingData {
  id: string;
  title: string;
  date: string;
  estimatedDuration: string;
  language: string;
  participants: Participant[];
  executiveSummary: ExecutiveSummary;
  actionItems: ActionItem[];
  transcript: TranscriptSegment[];
  audioBlobUrl?: string;
  audioFileName?: string;
  sourceType: 'file' | 'link' | 'mic' | 'sample';
  sourceUrl?: string;
}
