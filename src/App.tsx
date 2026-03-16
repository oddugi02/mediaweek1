/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  UserCircle,
  Plus,
  Upload,
  Zap,
  Clock,
  Target,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Mic2,
  Volume2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Search,
  Palette,
  LogIn,
  LogOut,
  FolderPlus,
  Folder,
  GripVertical,
  Edit2,
  Save,
  X,
  GraduationCap,
  Sparkles,
  Loader2,
  RotateCcw,
  User as UserIcon
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  pointerWithin,
  useDroppable,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'motion/react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, MeshDistortMaterial, Sphere, MeshWobbleMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { GoogleGenAI, Type, Modality, ThinkingLevel } from "@google/genai";
import { cn } from './lib/utils';
import { auth, db } from './firebase';
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  orderBy,
  getDocFromServer
} from 'firebase/firestore';

// --- Types ---

interface Assignment {
  id: string;
  title: string;
  description: string;
  steps: AssignmentStep[];
  direction: string;
  references: string[];
  cheerMessage?: string;
  professorStyle?: string;
  deadline?: string;
  createdAt: number;
  userId: string;
}

interface AssignmentStep {
  id: string;
  text: string;
  completed: boolean;
  duration?: string;
}

interface TimetableEntry {
  day: string;
  subject: string;
  startTime: string;
  endTime: string;
}

interface UserProfile {
  name: string;
  department: string;
  timetable: TimetableEntry[];
  userId: string;
}

interface ProfessorInsight {
  id: string;
  title?: string;
  professorName?: string;
  style: string;
  points: string[];
  strategy: string;
  redFlags?: string[];
  preferredStyles?: string[];
  folderId?: string;
  createdAt: number;
  userId: string;
  history?: {
    title?: string;
    style: string;
    points: string[];
    strategy: string;
    redFlags?: string[];
    preferredStyles?: string[];
    updatedAt: number;
  }[];
}

interface InsightFolder {
  id: string;
  name: string;
  createdAt: number;
  userId: string;
}

interface AppNotification {
  id: string;
  message: string;
  onUndo?: () => void;
}

// --- Constants ---

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

const MINDSET_QUOTES = [
  {
    title: "성적과 디자인 실력의 상관관계",
    content: "디자인 교육에서 학점은 '주어진 문제를 해결하는 프로세스'에 대한 성실도를 측정합니다. 하지만 실제 필드에서 요구되는 '독창적인 시각'과 '트렌드를 읽는 감각'은 수치화하기 어려운 영역입니다. 세계적인 디자이너 폴 랜드(Paul Rand)는 디자인을 '단순한 미학이 아닌 관계의 조화'라고 정의했습니다. 학점이 낮다고 해서 당신의 감각이 부족한 것이 아니라, 단지 학교라는 시스템의 평가 지표와 당신의 예술적 지향점이 잠시 어긋나 있을 뿐입니다.",
    source: "Design Philosophy & Professional Practice"
  },
  {
    title: "디자인의 주관성과 객관성 사이",
    content: "디자인은 예술과 달리 '목적'이 있는 행위입니다. 누군가는 당신의 작업물을 비판할 수 있지만, 그것이 당신의 실패를 의미하지는 않습니다. 디터 람스(Dieter Rams)의 '좋은 디자인의 10가지 원칙'조차 시대에 따라 재해석됩니다. 평가는 주관적일 수밖에 없으며, 중요한 것은 '왜 이렇게 디자인했는가'에 대한 당신만의 논리적 근거입니다. 비판을 당신의 인격과 분리하고, 그것을 더 견고한 논리를 만드는 재료로 삼으세요.",
    source: "Industrial Design Principles"
  },
  {
    title: "아이라 글래스의 '창작의 간극(The Gap)'",
    content: "초보 디자이너가 겪는 가장 큰 고통은 '자신의 안목'과 '자신의 실력' 사이의 간극입니다. 당신이 당신의 결과물에 만족하지 못하는 이유는 당신의 안목이 이미 수준 높기 때문입니다. 이 간극을 메우는 유일한 방법은 수많은 작업을 반복하는 것뿐입니다. 지금의 부족함은 당신이 더 높은 곳을 바라보고 있다는 증거입니다. 당신의 안목을 믿고, 그 과정 자체를 긍정하세요.",
    source: "Creative Process Insights"
  },
  {
    title: "포트폴리오가 말해주는 진실",
    content: "취업 시장에서 기업이 가장 먼저 보는 것은 성적표가 아닌 포트폴리오입니다. 포트폴리오는 당신이 문제를 어떻게 정의하고, 어떤 과정을 거쳐 해결책을 찾아냈는지를 보여주는 살아있는 증거입니다. 학점은 성실함을 증명할 수 있지만, 포트폴리오는 당신의 가능성을 증명합니다. 학교의 틀에 갇히지 말고, 당신이 진짜 하고 싶은 디자인이 무엇인지 끊임없이 질문하고 기록하세요.",
    source: "Design Career Roadmap"
  },
  {
    title: "번아웃과 창의성의 관계",
    content: "심리학적으로 창의성은 '여유'와 '놀이'의 상태에서 극대화됩니다. 과도한 경쟁과 학점에 대한 압박은 뇌의 전두엽을 경직시켜 오히려 창의적인 발상을 방해합니다. 가끔은 과제에서 벗어나 전혀 다른 분야의 예술을 접하거나 휴식을 취하는 것이 디자인 실력을 높이는 가장 빠른 길일 수 있습니다. 당신의 멘탈을 지키는 것이 곧 당신의 디자인 퀄리티를 지키는 것입니다.",
    source: "Psychology of Creativity"
  }
];
// --- Utils ---
// 이미지를 최대 1024px로 줄이고 화질을 70%로 압축하는 마법의 함수
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        // jpeg 포맷으로 70% 퀄리티 압축
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};
// --- App Component ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analyze' | 'timetable' | 'professor' | 'archive'>('dashboard');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [professorInsights, setProfessorInsights] = useState<ProfessorInsight[]>([]);
  const [folders, setFolders] = useState<InsightFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | 'all'>('all');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAnalyzingAssignment, setIsAnalyzingAssignment] = useState(false);
  const [isAnalyzingTimetable, setIsAnalyzingTimetable] = useState(false);
  const [isAnalyzingProfessor, setIsAnalyzingProfessor] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const addNotification = (message: string, onUndo?: () => void) => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications(prev => [...prev, { id, message, onUndo }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [profImage, setProfImage] = useState<string | null>(null);
  const [profNameInput, setProfNameInput] = useState('');
  const [profTitleInput, setProfTitleInput] = useState('');
  const [isInsightsPanelExpanded, setIsInsightsPanelExpanded] = useState(true);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const prevAssignmentsRef = useRef<Assignment[]>([]);

  const [selectedProfId, setSelectedProfId] = useState('');
  const [manualProfName, setManualProfName] = useState('');
  const [deadlineInput, setDeadlineInput] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize AI
  const aiRef = useRef<GoogleGenAI | null>(null);

  useEffect(() => {
    aiRef.current = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

    // Test Firestore connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
    setQuoteIndex(Math.floor(Math.random() * MINDSET_QUOTES.length));

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Data from Firestore
  useEffect(() => {
    // 1. effectiveUid를 조건문 밖으로 빼서 이 useEffect 안의 모든 곳에서 쓸 수 있게 만듭니다.
    const effectiveUid = user?.uid || "여기에_파이어베이스에서_복사한_아영님_UID를_넣으세요";

    if (!effectiveUid) return;

    // Assignments listener
    const q = query(
      collection(db, 'assignments'),
      where('userId', '==', effectiveUid), // 👈 user.uid 대신 effectiveUid 적용
      orderBy('createdAt', 'desc')
    );
    const unsubAssignments = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assignment));
      setAssignments(docs);
    }, (error) => {
      console.error("Firestore Error (Assignments):", error);
    });

    // Profile listener
    const unsubProfile = onSnapshot(doc(db, 'users', effectiveUid), (docSnap) => { // 👈 effectiveUid 적용
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        // Create initial profile if not exists
        const initialProfile: UserProfile = {
          name: user?.displayName || '김아영', // 👈 로그인을 안했을 때를 대비해 user? 처리 및 기본 이름 설정
          department: '시각디자인학과',
          timetable: [],
          userId: effectiveUid // 👈 effectiveUid 적용
        };
        setDoc(doc(db, 'users', effectiveUid), initialProfile); // 👈 effectiveUid 적용
      }
    }, (error) => {
      console.error("Firestore Error (Profile):", error);
    });

    // Professor Insights listener
    const qProf = query(
      collection(db, 'professor_insights'),
      where('userId', '==', effectiveUid), // 👈 effectiveUid 적용
      orderBy('createdAt', 'desc')
    );
    const unsubProf = onSnapshot(qProf, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProfessorInsight));
      setProfessorInsights(docs);
    }, (error) => {
      console.error("Firestore Error (Professor Insights):", error);
    });

    // Folders listener
    const qFolders = query(
      collection(db, 'insight_folders'),
      where('userId', '==', effectiveUid), // 👈 effectiveUid 적용
      orderBy('createdAt', 'desc')
    );
    const unsubFolders = onSnapshot(qFolders, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InsightFolder));
      setFolders(docs);
    }, (error) => {
      console.error("Firestore Error (Folders):", error);
    });

    return () => {
      unsubAssignments();
      unsubProfile();
      unsubProf();
      unsubFolders();
    };
  }, [user]);

  // Archive movement logic
  useEffect(() => {
    if (activeTab === 'dashboard') {
      const justCompleted = assignments.find(a => {
        const prev = prevAssignmentsRef.current.find(pa => pa.id === a.id);
        if (!prev) return false;
        const prevProgress = (prev.steps.filter(s => s.completed).length / prev.steps.length) * 100;
        const currProgress = (a.steps.filter(s => s.completed).length / a.steps.length) * 100;
        return prevProgress < 100 && currProgress === 100;
      });

      if (justCompleted) {
        addNotification(`축하합니다! '${justCompleted.title}' 과제를 완수했습니다.`);
        // Small delay to let the user see the completion before switching tab
        setTimeout(() => {
          setActiveTab('archive');
        }, 800);
      }
    } else if (activeTab === 'archive') {
      const justUncompleted = assignments.find(a => {
        const prev = prevAssignmentsRef.current.find(pa => pa.id === a.id);
        if (!prev) return false;
        const prevProgress = (prev.steps.filter(s => s.completed).length / prev.steps.length) * 100;
        const currProgress = (a.steps.filter(s => s.completed).length / a.steps.length) * 100;
        return prevProgress === 100 && currProgress < 100;
      });

      if (justUncompleted) {
        setActiveTab('dashboard');
      }
    }
    prevAssignmentsRef.current = assignments;
  }, [assignments, activeTab]);

  // --- Auth Actions ---

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  // --- AI Actions ---

  const analyzeAssignment = async (text: string, imageBase64?: string, professorInsightId?: string, manualProfessorName?: string, deadline?: string) => {
    if (!aiRef.current || !user) return;
    setIsAnalyzingAssignment(true);
    try {
      let professorContext = "";
      if (professorInsightId && professorInsightId !== 'manual') {
        const insight = professorInsights.find(i => i.id === professorInsightId);
        if (insight) {
          professorContext = `
            이 과제는 다음 교수님의 성향을 반영해야 합니다:
            - 교수님 성향: ${insight.style}
            - 중요 포인트: ${insight.points.join(', ')}
            - 금기 사항 (Red Flags): ${insight.redFlags?.join(', ') || '없음'}
            - 선호하는 스타일: ${insight.preferredStyles?.join(', ') || '없음'}
            
            위 정보를 바탕으로 교수님이 선호할만한 방향으로 과제 전략을 세워주세요.
          `;
        }
      } else if (manualProfessorName) {
        professorContext = `이 과제는 '${manualProfessorName}' 교수님의 과제입니다. 해당 교수님의 일반적인 성향이나 과제 특성을 고려하여 전략을 세워주세요.`;
      }

      const prompt = `
        시각디자인학과 학생을 위한 과제 분석 전문가로서 다음 과제 설명을 분석해주세요.
        ${professorContext}
        
        설명: ${text}
        
        응답은 반드시 다음 JSON 형식으로만 해주세요:
        {
          "title": "과제 제목",
          "steps": ["단계 1: ...", "단계 2: ...", "단계 3: ...", "단계 4: ..."],
          "direction": "전체적인 디자인 방향성 제언 (교수님 성향 반영)",
          "references": ["레퍼런스 키워드 1", "레퍼런스 키워드 2"],
          "cheerMessage": "학생에게 주는 응원 메시지"
        }
      `;

      const parts: any[] = [{ text: prompt }];
      if (imageBase64) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: imageBase64.split(',')[1]
          }
        });
      }

      const result = await aiRef.current.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: "LOW" as any }
        }
      });

      const data = JSON.parse(result.text || '{}');
      const newAssignmentData = {
        title: data.title || '새 과제',
        description: text,
        steps: (data.steps || []).map((s: string) => ({ id: Math.random().toString(), text: s, completed: false })),
        direction: data.direction || '',
        references: data.references || [],
        cheerMessage: data.cheerMessage || '',
        deadline: deadline || '',
        createdAt: Date.now(),
        userId: user.uid
      };

      await addDoc(collection(db, 'assignments'), newAssignmentData);
      setActiveTab('dashboard');
      setSelectedProfId('');
      setManualProfName('');
      setDeadlineInput('');
      addNotification(`과제 분석 완료: ${newAssignmentData.title}`);
      speak(`과제 분석이 완료되었습니다. ${newAssignmentData.title}에 대한 전략을 확인해보세요.`);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzingAssignment(false);
    }
  };

  const analyzeTimetable = async (imageBase64: string) => {
    if (!aiRef.current || !user) return;
    setIsAnalyzingTimetable(true);
    try {
      // Proportional grid analysis prompt based on user's critical feedback
      const prompt = `
        시간표 이미지 분석 (PROPORTIONAL GRID ANALYSIS MODE).
        
        분석 원칙 (반드시 준수):
        1. 행(Row) 단위 분석: 시간표의 가로줄 한 칸은 정확히 '1시간'입니다.
        2. 라벨의 의미: 우측의 '오후 2시' 라벨은 해당 행이 시작되는 선(Top Line)이 14:00임을 의미합니다.
        3. 종료 시간 계산: 
           - 어떤 강의가 '오후 5시' 라벨이 붙은 행의 '아랫선(Bottom Line)'까지 꽉 채우고 있다면, 그 강의는 18:00에 끝나는 것입니다.
           - 어떤 강의가 행의 중간에서 끊긴다면, 30분(:30) 단위로 계산하세요. (예: 4시 행의 중간에서 끝나면 16:30)
        4. 실제 사례 적용:
           - '문학, 세상을 만나다': 2시 행 시작 ~ 4시 행 중간 종료 => 14:00 ~ 16:30
           - '그래픽디자인/타이포그래피': 2시 행 시작 ~ 5시 행 끝 종료 => 14:00 ~ 18:00
        
        추출 항목: 요일(월~금), 과목명, 시작시간, 종료시간.
        JSON 형식으로만 응답:
        [{"day": "요일", "subject": "과목명", "startTime": "HH:MM", "endTime": "HH:MM"}]
      `;

      const result = await aiRef.current.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: imageBase64.split(',')[1] } }
          ]
        },
        config: {
          responseMimeType: "application/json",
          // Suggesting lower thinking level for speed
          thinkingConfig: { thinkingLevel: "LOW" as any }
        }
      });

      const data = JSON.parse(result.text || '[]');
      if (profile) {
        await setDoc(doc(db, 'users', user.uid), { ...profile, timetable: data });
      }
      speak("시간표가 성공적으로 동기화되었습니다.");
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzingTimetable(false);
    }
  };

  const analyzeProfessorStyle = async (text: string, imageBase64?: string, customName?: string) => {
    if (!aiRef.current || !user) return;
    setIsAnalyzingProfessor(true);
    try {
      const prompt = `
        교수님의 작업물이나 SNS 내용을 바탕으로 디자인 스타일을 분석해주세요.
        1. 선호하는 미학적 스타일 (예: 미니멀리즘, 맥시멀리즘, 타이포그래피 중심 등)
        2. 과제 수행 시 중요하게 생각할 포인트 3가지
        3. 이 교수님에게 점수를 잘 받기 위한 전략적 제언
        4. 금기 사항 (Red Flags): 이 교수님이 싫어하거나 피해야 할 디자인 요소들
        5. 선호하는 레퍼런스 스타일: 이 교수님이 긍정적으로 평가할만한 시각적 레퍼런스 키워드
        
        정보: ${text}
        
        응답 형식 (JSON):
        {
          "professorName": "교수님 성함 (추측 가능할 경우, 모르면 생략)",
          "style": "스타일 요약",
          "points": ["포인트 1", "포인트 2", "포인트 3"],
          "strategy": "전략적 제언",
          "redFlags": ["금기 1", "금기 2"],
          "preferredStyles": ["스타일 1", "스타일 2"]
        }
      `;

      const parts: any[] = [{ text: prompt }];
      if (imageBase64) {
        parts.push({
          inlineData: { mimeType: "image/jpeg", data: imageBase64.split(',')[1] }
        });
      }

      const result = await aiRef.current.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: "LOW" as any }
        }
      });

      const data = JSON.parse(result.text || '{}');

      const newInsight = {
        professorName: customName || data.professorName || '분석된 교수님',
        style: data.style || '',
        points: data.points || [],
        strategy: data.strategy || '',
        redFlags: data.redFlags || [],
        preferredStyles: data.preferredStyles || [],
        createdAt: Date.now(),
        userId: user.uid,
        history: []
      };

      await addDoc(collection(db, 'professor_insights'), newInsight);
      const input = document.getElementById('prof-input') as HTMLTextAreaElement;
      if (input) input.value = '';
      setProfImage(null);
      setProfNameInput('');
      addNotification(`교수님 스타일 분석 완료: ${newInsight.professorName}`);
      speak("교수님 스타일 분석이 완료되었습니다. 인사이트 탭에서 확인해보세요.");
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzingProfessor(false);
    }
  };

  const deleteProfessorInsight = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'professor_insights', id));
    } catch (error) {
      console.error("Delete Insight Error:", error);
    }
  };

  const handleUpdateProfessorName = async (id: string, newName: string) => {
    try {
      await updateDoc(doc(db, 'professor_insights', id), { professorName: newName });
    } catch (error) {
      console.error("Error updating professor name:", error);
    }
  };

  const developProfessorInsight = async (id: string, newText: string, newImageBase64?: string) => {
    if (!aiRef.current || !user) return;
    try {
      const insight = professorInsights.find(i => i.id === id);
      if (!insight) return;

      const prompt = `
        기존의 교수님 스타일 분석 데이터에 새로운 정보(텍스트/이미지)를 추가하여 분석을 더 정교하게 업데이트해주세요.
        기존 데이터와 새로운 정보를 종합하여 더 깊이 있는 인사이트를 도출해야 합니다.
        
        기존 데이터:
        - 스타일: ${insight.style}
        - 중요 포인트: ${insight.points.join(', ')}
        - 전략: ${insight.strategy}
        - 금기 사항: ${insight.redFlags?.join(', ') || '없음'}
        - 선호 스타일: ${insight.preferredStyles?.join(', ') || '없음'}
        
        새로운 정보: ${newText}
        
        응답 형식 (JSON):
        {
          "professorName": "${insight.professorName}",
          "style": "업데이트된 스타일 요약",
          "points": ["업데이트된 포인트 1", "업데이트된 포인트 2", "업데이트된 포인트 3"],
          "strategy": "업데이트된 전략적 제언",
          "redFlags": ["업데이트된 금기 1", "업데이트된 금기 2"],
          "preferredStyles": ["업데이트된 스타일 1", "업데이트된 스타일 2"]
        }
      `;

      const parts: any[] = [{ text: prompt }];
      if (newImageBase64) {
        parts.push({
          inlineData: { mimeType: "image/jpeg", data: newImageBase64.split(',')[1] }
        });
      }

      const result = await aiRef.current.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });

      const data = JSON.parse(result.text || '{}');

      const currentVersion = {
        style: insight.style,
        points: insight.points,
        strategy: insight.strategy,
        redFlags: insight.redFlags || [],
        preferredStyles: insight.preferredStyles || [],
        updatedAt: Date.now()
      };

      const newHistory = [...(insight.history || []), currentVersion];

      await updateDoc(doc(db, 'professor_insights', id), {
        style: data.style || insight.style,
        points: data.points || insight.points,
        strategy: data.strategy || insight.strategy,
        redFlags: data.redFlags || insight.redFlags,
        preferredStyles: data.preferredStyles || insight.preferredStyles,
        history: newHistory,
        updatedAt: Date.now()
      });

      addNotification(
        `${insight.professorName} 인사이트 업데이트 완료`,
        () => undoProfessorInsight(id)
      );
      speak("교수님 인사이트가 성공적으로 업데이트되었습니다.");
    } catch (error) {
      console.error(error);
    }
  };

  const undoProfessorInsight = async (id: string) => {
    try {
      const insight = professorInsights.find(i => i.id === id);
      if (!insight || !insight.history || insight.history.length === 0) return;

      const previous = insight.history[insight.history.length - 1];
      const newHistory = insight.history.slice(0, -1);

      await updateDoc(doc(db, 'professor_insights', id), {
        ...previous,
        history: newHistory,
        updatedAt: Date.now()
      });
      speak("이전 버전으로 복원되었습니다.");
    } catch (error) {
      console.error("Undo Error:", error);
    }
  };

  const handleCreateFolder = async () => {
    if (!user || !newFolderName.trim()) return;
    try {
      await addDoc(collection(db, 'insight_folders'), {
        name: newFolderName.trim(),
        userId: user.uid,
        createdAt: Date.now()
      });
      setNewFolderName('');
      setIsCreatingFolder(false);
      addNotification("폴더가 생성되었습니다.");
    } catch (error) {
      console.error("Error creating folder:", error);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm("폴더를 삭제하시겠습니까? (폴더 안의 인사이트는 삭제되지 않습니다)")) return;
    try {
      // Unset folderId for insights in this folder
      const insightsToUpdate = professorInsights.filter(i => i.folderId === id);
      for (const insight of insightsToUpdate) {
        await updateDoc(doc(db, 'professor_insights', insight.id), { folderId: null });
      }
      await deleteDoc(doc(db, 'insight_folders', id));
      if (activeFolderId === id) setActiveFolderId('all');
      addNotification("폴더가 삭제되었습니다.");
    } catch (error) {
      console.error("Error deleting folder:", error);
    }
  };

  const handleRenameFolder = async (id: string, newName: string) => {
    try {
      await updateDoc(doc(db, 'insight_folders', id), { name: newName });
      addNotification("폴더 이름이 변경되었습니다.");
    } catch (error) {
      console.error("Error renaming folder:", error);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (over && active.id !== over.id) {
      const insightId = active.id as string;
      const targetId = over.id as string;

      // If dropped over a folder
      if (folders.some(f => f.id === targetId)) {
        try {
          await updateDoc(doc(db, 'professor_insights', insightId), { folderId: targetId });
        } catch (error) {
          console.error("Error moving insight to folder:", error);
        }
      } else if (targetId === 'all') {
        try {
          await updateDoc(doc(db, 'professor_insights', insightId), { folderId: null });
        } catch (error) {
          console.error("Error moving insight to all:", error);
        }
      }
    }
  };

  const filteredInsights = activeFolderId === 'all'
    ? professorInsights
    : professorInsights.filter(i => i.folderId === activeFolderId);

  const speak = async (text: string) => {
    if (!aiRef.current) return;
    try {
      const response = await aiRef.current.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        }
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const url = `data:audio/mp3;base64,${base64Audio}`;
        setAudioUrl(url);
        const audio = new Audio(url);
        audio.play();
      }
    } catch (error) {
      console.error("TTS Error:", error);
    }
  };

  const toggleStep = async (assignmentId: string, stepId: string) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return;

    const updatedSteps = assignment.steps.map(s =>
      s.id === stepId ? { ...s, completed: !s.completed } : s
    );

    try {
      await setDoc(doc(db, 'assignments', assignmentId), {
        ...assignment,
        steps: updatedSteps
      });
    } catch (error) {
      console.error("Update Step Error:", error);
    }
  };

  const deleteAssignment = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'assignments', id));
    } catch (error) {
      console.error("Delete Assignment Error:", error);
    }
  };

  // --- UI Components ---

  if (!isAuthReady) {
    return (
      <div className="h-screen bg-[#0A0A0A] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen atmosphere-bg flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md space-y-8 glass p-12 rounded-[40px]"
        >
          <div className="space-y-4">
            <div className="w-20 h-20 bg-orange-500/10 rounded-3xl flex items-center justify-center mx-auto">
              <Zap className="text-orange-500 w-10 h-10 fill-orange-500" />
            </div>
            <h1 className="text-4xl font-bold tracking-tighter text-zinc-900">STUDIO PILOT</h1>
            <p className="text-zinc-600 text-lg">시각디자인학과 학생들을 위한 과제 전략 컨트롤 타워</p>
          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-black transition-all shadow-lg"
          >
            <LogIn size={24} />
            Google 계정으로 시작하기
          </button>

          <p className="text-zinc-500 text-sm">과제 분석, 시간표 동기화, 교수님 스타일 분석을 한 번에.</p>
        </motion.div>
      </div>
    );
  }

  const Sidebar = () => (
    <div className="w-64 glass border-r border-white/20 flex flex-col h-full z-20">
      <div className="p-8">
        <h1 className="text-xl font-bold tracking-tighter flex items-center gap-2 text-zinc-900">
          <Zap className="w-6 h-6 text-orange-500 fill-orange-500" />
          STUDIO PILOT
        </h1>
        <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-mono">Visual Design Navigator</p>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1">
        <SidebarItem
          icon={<LayoutDashboard size={18} />}
          label="대시보드"
          active={activeTab === 'dashboard'}
          onClick={() => setActiveTab('dashboard')}
        />
        <SidebarItem
          icon={<CheckCircle2 size={18} />}
          label="완료된 과제 보관함"
          active={activeTab === 'archive'}
          onClick={() => setActiveTab('archive')}
        />
        <SidebarItem
          icon={<Palette size={18} />}
          label="교수님 인사이트"
          active={activeTab === 'professor'}
          onClick={() => setActiveTab('professor')}
          loading={isAnalyzingProfessor}
        />
        <SidebarItem
          icon={<BookOpen size={18} />}
          label="과제 분석기"
          active={activeTab === 'analyze'}
          onClick={() => setActiveTab('analyze')}
          loading={isAnalyzingAssignment}
        />

      </nav>

      <div className="p-6 border-t border-white/20 space-y-4">
        <div className="flex items-center gap-3 p-3 glass rounded-2xl">
          <img
            src={user.photoURL || ''}
            alt={user.displayName || ''}
            className="w-10 h-10 rounded-full border border-white/40"
            referrerPolicy="no-referrer"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate text-zinc-900">{user.displayName}</p>
            <p className="text-[10px] text-zinc-500 uppercase truncate">{profile?.department || '시각디자인학과'}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs text-zinc-500 hover:bg-white/40 hover:text-zinc-800 transition-all"
        >
          <LogOut size={14} />
          로그아웃
        </button>
      </div>
    </div>
  );

  const SidebarItem = ({ icon, label, active, onClick, loading }: any) => (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 relative",
        active ? "bg-orange-500/10 text-orange-600 font-bold shadow-sm" : "text-zinc-500 hover:bg-white/40 hover:text-zinc-900"
      )}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {loading && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-3 h-3 border-2 border-orange-500/20 border-t-orange-500 rounded-full"
        />
      )}
    </button>
  );

  return (
    <div className="flex h-screen atmosphere-bg text-zinc-800 font-sans selection:bg-orange-500/20">
      {/* Notifications */}
      <div className="fixed top-8 left-8 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.95 }}
              className="pointer-events-auto glass px-6 py-4 rounded-2xl shadow-2xl border border-white/40 flex items-center gap-4 min-w-[300px]"
            >
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                <Zap size={20} className="fill-white" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">Notification</p>
                <p className="text-sm font-bold text-zinc-900">{n.message}</p>
                {n.onUndo && (
                  <button
                    onClick={() => {
                      n.onUndo?.();
                      setNotifications(prev => prev.filter(notif => notif.id !== n.id));
                    }}
                    className="text-[10px] text-purple-600 font-bold hover:underline mt-1 flex items-center gap-1"
                  >
                    <RotateCcw size={10} />
                    실행 취소 (Undo)
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Sidebar />

      <main className="flex-1 overflow-y-auto relative z-10">
        <div className="fixed right-8 top-1/2 -translate-y-1/2 [writing-mode:vertical-rl] rotate-180 text-[10px] font-bold text-zinc-300 uppercase tracking-[0.5em] pointer-events-none z-0">
          {activeTab} / STUDIO PILOT
        </div>

        {((activeTab === 'analyze' && isAnalyzingAssignment) ||
          (activeTab === 'professor' && isAnalyzingProfessor)) && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full"
              />
              <p className="font-mono text-xs text-orange-600 animate-pulse uppercase tracking-widest font-bold">Processing...</p>
            </div>
          )}

        <div className="max-w-5xl mx-auto p-12">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-12"
              >
                <header className="flex justify-between items-end">
                  <div>
                    <h2 className="text-4xl font-bold tracking-tight text-zinc-900">현재 프로젝트</h2>
                    <p className="text-zinc-500 mt-2">당신의 디자인 여정을 가이드합니다.</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('analyze')}
                    className="flex items-center gap-2 bg-zinc-900 hover:bg-black text-white px-6 py-3 rounded-full font-bold transition-all shadow-lg"
                  >
                    <Plus size={20} />
                    새 과제 추가
                  </button>
                </header>

                {/* Mindset Card */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass p-6 rounded-[32px] border-l-4 border-orange-400 flex flex-col md:flex-row items-start gap-6 group cursor-pointer hover:shadow-xl transition-all duration-500 max-w-3xl"
                  onClick={() => setQuoteIndex((quoteIndex + 1) % MINDSET_QUOTES.length)}
                >
                  <div className="w-14 h-14 bg-orange-500/10 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Target className="text-orange-500" size={28} />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] text-orange-600 font-bold uppercase tracking-widest">Designer's Insight</p>
                      <p className="text-[10px] text-zinc-400 font-mono">Source: {MINDSET_QUOTES[quoteIndex].source}</p>
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900">{MINDSET_QUOTES[quoteIndex].title}</h3>
                    <p className="text-sm text-zinc-600 leading-relaxed">
                      {MINDSET_QUOTES[quoteIndex].content}
                    </p>
                    <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-medium">
                      <Zap size={12} className="text-orange-400" />
                      클릭하여 다음 인사이트 보기
                    </div>
                  </div>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                  {assignments.filter(a => {
                    const progress = (a.steps.filter(s => s.completed).length / a.steps.length) * 100;
                    return progress < 100;
                  }).length === 0 ? (
                    <div className="col-span-2 py-24 glass rounded-[40px] flex flex-col items-center justify-center text-zinc-400">
                      <BookOpen size={48} className="mb-4 opacity-20" />
                      <p>진행 중인 과제가 없습니다.</p>
                    </div>
                  ) : (
                    assignments.filter(a => {
                      const progress = (a.steps.filter(s => s.completed).length / a.steps.length) * 100;
                      return progress < 100;
                    }).map(assignment => (
                      <AssignmentCard
                        key={assignment.id}
                        assignment={assignment}
                        onDelete={deleteAssignment}
                        onToggleStep={toggleStep}
                      />
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'archive' && (
              <motion.div
                key="archive"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-12"
              >
                <header>
                  <h2 className="text-4xl font-bold tracking-tight text-zinc-900">완료된 과제 보관함</h2>
                  <p className="text-zinc-500 mt-2">지금까지 완수한 멋진 프로젝트들입니다.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                  {assignments.filter(a => {
                    const progress = (a.steps.filter(s => s.completed).length / a.steps.length) * 100;
                    return progress === 100;
                  }).length === 0 ? (
                    <div className="col-span-2 py-24 glass rounded-[40px] flex flex-col items-center justify-center text-zinc-400">
                      <CheckCircle2 size={48} className="mb-4 opacity-20" />
                      <p>완료된 과제가 아직 없습니다.</p>
                    </div>
                  ) : (
                    assignments.filter(a => {
                      const progress = (a.steps.filter(s => s.completed).length / a.steps.length) * 100;
                      return progress === 100;
                    }).map(assignment => (
                      <AssignmentCard
                        key={assignment.id}
                        assignment={assignment}
                        onDelete={deleteAssignment}
                        onToggleStep={toggleStep}
                      />
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'analyze' && (
              <motion.div
                key="analyze"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-2xl mx-auto space-y-8"
              >
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto">
                    <Zap className="text-orange-500" size={32} />
                  </div>
                  <h2 className="text-3xl font-bold text-zinc-900">과제 전략 수립</h2>
                  <p className="text-zinc-500">과제 설명문을 입력하거나 캡처 이미지를 업로드하세요.</p>
                </div>

                <div className="glass rounded-[40px] p-10 space-y-6">
                  <div className="flex flex-col gap-3">
                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Deadline (Optional)</p>
                    <input
                      type="date"
                      value={deadlineInput}
                      onChange={(e) => setDeadlineInput(e.target.value)}
                      className="w-full bg-white/60 border border-white/40 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Professor Selection (Optional)</p>
                    <div className="flex flex-col gap-3">
                      <select
                        value={selectedProfId}
                        onChange={(e) => setSelectedProfId(e.target.value)}
                        className="w-full bg-white/60 border border-white/40 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                      >
                        <option value="">교수님 선택 안함</option>
                        <option value="manual">직접 입력</option>
                        {professorInsights.map(insight => (
                          <option key={insight.id} value={insight.id}>{insight.professorName}</option>
                        ))}
                      </select>

                      {selectedProfId === 'manual' && (
                        <motion.input
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          type="text"
                          value={manualProfName}
                          onChange={(e) => setManualProfName(e.target.value)}
                          placeholder="교수님 성함을 입력하세요..."
                          className="w-full bg-white/60 border border-white/40 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                        />
                      )}
                    </div>
                  </div>

                  <textarea
                    id="assignment-input"
                    placeholder="교수님이 주신 과제 가이드를 여기에 붙여넣으세요..."
                    className="w-full h-48 bg-transparent border-none focus:ring-0 text-lg resize-none placeholder:text-zinc-400 text-zinc-800"
                  />

                  <div className="flex gap-4">
                    <button
                      onClick={() => {
                        const text = (document.getElementById('assignment-input') as HTMLTextAreaElement).value;
                        if (text) analyzeAssignment(text, undefined, selectedProfId, manualProfName, deadlineInput);
                      }}
                      className="flex-1 bg-zinc-900 hover:bg-black text-white py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                      disabled={isAnalyzingAssignment}
                    >
                      {isAnalyzingAssignment ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        >
                          <Loader2 size={20} />
                        </motion.div>
                      ) : (
                        <Zap size={20} />
                      )}
                      {isAnalyzingAssignment ? '분석 중...' : '전략 분석 시작'}
                    </button>
                    <label className="cursor-pointer bg-white/60 hover:bg-white p-4 rounded-2xl transition-all border border-white/40 shadow-sm">
                      <Upload size={24} className="text-zinc-600" />
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const text = (document.getElementById('assignment-input') as HTMLTextAreaElement).value;
                              analyzeAssignment(text || "이미지 기반 과제 분석", ev.target?.result as string, selectedProfId, manualProfName, deadlineInput);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </motion.div>
            )}



            {activeTab === 'professor' && (
              <motion.div
                key="professor"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-12"
              >
                <div className="max-w-2xl mx-auto space-y-8">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto">
                      <Search className="text-purple-600" size={32} />
                    </div>
                    <h2 className="text-3xl font-bold text-zinc-900">교수님 인사이트</h2>
                    <p className="text-zinc-500">교수님의 SNS 텍스트나 작업물 이미지를 입력하세요.</p>
                  </div>

                  <div className="glass rounded-[40px] p-10 space-y-6">
                    <div className="space-y-4">
                      <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">교수님 선택 또는 입력</p>
                      <div className="flex flex-col md:flex-row gap-4">
                        <select
                          value={profNameInput && Array.from(new Set(professorInsights.map(i => i.professorName))).includes(profNameInput) ? profNameInput : 'manual'}
                          onChange={(e) => {
                            if (e.target.value === 'manual') {
                              setProfNameInput('');
                            } else {
                              setProfNameInput(e.target.value);
                            }
                          }}
                          className="flex-1 bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-zinc-800 focus:ring-2 focus:ring-purple-500 outline-none"
                        >
                          <option value="manual">직접 입력</option>
                          {Array.from(new Set(professorInsights.map(i => i.professorName))).filter(Boolean).map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="교수님 성함을 입력하세요 (필수)"
                          value={profNameInput}
                          onChange={(e) => setProfNameInput(e.target.value)}
                          className="flex-1 bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-zinc-800 focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>
                    </div>

                    <textarea
                      id="prof-input"
                      placeholder="교수님의 평소 말씀이나 작업물에 대한 설명을 적어주세요..."
                      className="w-full h-48 bg-transparent border-none focus:ring-0 text-lg resize-none placeholder:text-zinc-400 text-zinc-800"
                    />

                    {profImage && (
                      <div className="relative w-32 h-32 group">
                        <img
                          src={profImage}
                          alt="Preview"
                          className="w-full h-full object-cover rounded-2xl border border-white/40 shadow-md"
                        />
                        <button
                          onClick={() => setProfImage(null)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg hover:bg-red-600 transition-all"
                        >
                          <X size={14} />
                        </button>
                        <div className="absolute inset-0 bg-black/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                          <p className="text-[10px] text-white font-bold uppercase">업로드됨</p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-4">
                      <button
                        onClick={() => {
                          const text = (document.getElementById('prof-input') as HTMLTextAreaElement).value;
                          if (!profNameInput.trim()) {
                            alert("교수님 성함을 입력해주세요.");
                            return;
                          }
                          if (text || profImage) analyzeProfessorStyle(text, profImage || undefined, profNameInput);
                        }}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                        disabled={isAnalyzingProfessor}
                      >
                        {isAnalyzingProfessor ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                          >
                            <Loader2 size={20} />
                          </motion.div>
                        ) : (
                          <Zap size={20} />
                        )}
                        {isAnalyzingProfessor ? '분석 중...' : '스타일 분석 시작'}
                      </button>
                      <label className="cursor-pointer bg-white/60 hover:bg-white p-4 rounded-2xl transition-all border border-white/40 shadow-sm">
                        <Upload size={24} className="text-zinc-600" />
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                setProfImage(ev.target?.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-8 pt-12">
                  <AnimatePresence>
                    {isCreatingFolder && (
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="glass p-6 rounded-3xl border border-purple-100 mb-8 flex items-center gap-4"
                      >
                        <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-500">
                          <FolderPlus size={24} />
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="새 폴더 이름을 입력하세요..."
                            className="w-full bg-transparent border-none text-lg font-bold focus:ring-0 outline-none"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleCreateFolder}
                            className="bg-purple-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-purple-700 transition-all"
                          >
                            생성
                          </button>
                          <button
                            onClick={() => { setIsCreatingFolder(false); setNewFolderName(''); }}
                            className="px-4 py-2 rounded-xl border border-zinc-200 text-zinc-500 font-bold hover:bg-zinc-50 transition-all"
                          >
                            취소
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <header className="flex justify-between items-end">
                    <div>
                      <h3 className="text-2xl font-bold text-zinc-900">저장된 인사이트</h3>
                      <p className="text-zinc-500 mt-1">인사이트를 드래그하여 폴더에 정리하세요.</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setIsInsightsPanelExpanded(!isInsightsPanelExpanded)}
                        className="p-3 text-zinc-400 hover:text-zinc-600 transition-all"
                      >
                        {isInsightsPanelExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                      </button>
                      <button
                        onClick={() => setIsCreatingFolder(true)}
                        className="flex items-center gap-2 bg-white border border-zinc-200 text-zinc-600 px-6 py-3 rounded-full font-bold hover:bg-zinc-50 transition-all"
                      >
                        <FolderPlus size={20} />
                        폴더 추가
                      </button>
                    </div>
                  </header>

                  <AnimatePresence>
                    {isInsightsPanelExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col md:flex-row gap-8">
                          <DndContext
                            sensors={sensors}
                            collisionDetection={pointerWithin}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                          >
                            {/* Folder Sidebar */}
                            <div className="w-full md:w-64 space-y-2">
                              <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest px-4 mb-4">Folders</p>
                              <DroppableFolder
                                id="all"
                                name="전체보기"
                                icon={<LayoutDashboard size={18} />}
                                active={activeFolderId === 'all'}
                                count={professorInsights.length}
                                onClick={() => setActiveFolderId('all')}
                              />

                              {folders.map(folder => (
                                <DroppableFolder
                                  key={folder.id}
                                  id={folder.id}
                                  name={folder.name}
                                  icon={<Folder size={18} />}
                                  active={activeFolderId === folder.id}
                                  count={professorInsights.filter(i => i.folderId === folder.id).length}
                                  onClick={() => setActiveFolderId(folder.id)}
                                  onDelete={() => handleDeleteFolder(folder.id)}
                                  onRename={handleRenameFolder}
                                />
                              ))}
                            </div>

                            {/* Insights Grid with DND */}
                            <div className="flex-1">
                              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                {filteredInsights.length === 0 ? (
                                  <div className="col-span-full py-24 glass rounded-[40px] flex flex-col items-center justify-center text-zinc-400">
                                    <GraduationCap size={64} className="mb-6 opacity-20" />
                                    <p className="text-lg font-medium">인사이트가 없습니다.</p>
                                  </div>
                                ) : (
                                  filteredInsights.map(insight => (
                                    <SortableInsightCard
                                      key={insight.id}
                                      insight={insight}
                                      onDelete={deleteProfessorInsight}
                                      onUpdateName={handleUpdateProfessorName}
                                      onDevelop={developProfessorInsight}
                                      onUndo={undoProfessorInsight}
                                    />
                                  ))
                                )}
                              </div>

                              <DragOverlay>
                                {activeDragId ? (
                                  <div className="glass p-6 rounded-3xl border border-orange-500/30 shadow-2xl opacity-80 scale-105 w-80">
                                    <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white">
                                        <UserCircle size={20} />
                                      </div>
                                      <h3 className="font-bold text-zinc-900 truncate">
                                        {professorInsights.find(i => i.id === activeDragId)?.professorName}
                                      </h3>
                                    </div>
                                  </div>
                                ) : null}
                              </DragOverlay>
                            </div>
                          </DndContext>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// --- Sub-components ---

function Progress3D({ progress }: { progress: number }) {
  // 1. 모션 멈춤 여부를 기억하는 상태(State) 추가
  const [isPaused, setIsPaused] = useState(false);

  return (
    // group 클래스를 추가해서 마우스를 올렸을 때만 버튼이 보이게 만듭니다.
    <div className="h-48 w-full bg-zinc-900/5 rounded-[32px] overflow-hidden relative group">

      {/* 2. ON/OFF 토글 버튼 디자인 (우측 상단) */}
      <button
        onClick={() => setIsPaused(!isPaused)}
        className="absolute top-4 right-4 z-10 bg-white/80 hover:bg-white text-zinc-500 hover:text-orange-500 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm backdrop-blur-md transition-all opacity-0 group-hover:opacity-100"
      >
        {isPaused ? 'Motion: OFF' : 'Motion: ON'}
      </button>

      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.9} color="#ffffff" />
        <directionalLight position={[5, 5, 5]} intensity={1.5} color="#e0f2fe" />
        <pointLight position={[-10, -10, -10]} intensity={0.6} color="#fce7f3" />

        {/* 3. 멈춤 상태일 땐 Float(둥둥 떠다니는 효과)도 0으로 만듭니다 */}
        <Float
          speed={isPaused ? 0 : 1.5}
          rotationIntensity={isPaused ? 0 : 0.5}
          floatIntensity={isPaused ? 0 : 0.8}
        >
          <ProgressObject progress={progress} isPaused={isPaused} />
        </Float>
        <OrbitControls enableZoom={false} enablePan={false} />
      </Canvas>
      <div className="absolute bottom-4 right-6 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
        Progress: {Math.round(progress)}%
      </div>
    </div>
  );
}

// 4. ProgressObject가 isPaused 상태를 전달받도록 수정
function ProgressObject({ progress, isPaused }: { progress: number, isPaused: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const factor = progress / 100;

  // 5. 멈춤 상태(isPaused)면 유동성과 속도를 강제로 0으로 만들어 고정시킵니다.
  const currentDistort = isPaused ? 0 : 0.6 * (1 - factor);
  const currentSpeed = isPaused ? 0 : 4 * (1 - factor);

  useFrame((state, delta) => {
    // 6. 멈춤 상태가 아닐 때만 회전하고 숨을 쉬도록(Pulse) 조건문 추가
    if (meshRef.current && !isPaused) {
      const rotationSpeed = 0.2 * (1 - factor);
      meshRef.current.rotation.x += delta * rotationSpeed;
      meshRef.current.rotation.y += delta * (rotationSpeed * 0.8);

      const pulseIntensity = 0.05 * (1 - factor);
      const targetScale = 1 + Math.sin(state.clock.getElapsedTime() * 1.5) * pulseIntensity;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    }
  });

  const getColor = () => {
    if (factor === 1) return "#a8e6cf";
    if (factor > 0.5) return "#c1d3fe";
    return "#ffcce6";
  };

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.5, 64, 64]} />
      <MeshDistortMaterial
        color={getColor()}
        speed={currentSpeed}
        distort={currentDistort}
        radius={1}
        metalness={0.1}
        roughness={0.3}
        emissive={getColor()}
        emissiveIntensity={factor === 1 ? 0.1 : 0.2}
      />
    </mesh>
  );
}

function DroppableFolder({ id, name, icon, active, count, onClick, onDelete, onRename }: {
  key?: React.Key;
  id: string;
  name: string;
  icon: React.ReactNode;
  active: boolean;
  count: number;
  onClick: () => void;
  onDelete?: () => void | Promise<void>;
  onRename?: (id: string, newName: string) => void | Promise<void>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (editName.trim() && editName !== name && onRename) {
      onRename(id, editName.trim());
    }
    setIsEditing(false);
  };

  return (
    <div ref={setNodeRef} className="group relative">
      <div
        onClick={onClick}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all cursor-pointer",
          active ? "bg-zinc-900 text-white shadow-lg" : "text-zinc-600 hover:bg-zinc-100",
          isOver && !active && "bg-orange-500/10 border-2 border-dashed border-orange-500 scale-105"
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className={active ? 'text-orange-400' : 'text-zinc-400'}>{icon}</span>
          {isEditing ? (
            <form onSubmit={handleRename} className="flex-1">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleRename}
                className="w-full bg-white/10 text-white border-none rounded px-2 py-0.5 text-sm focus:ring-1 focus:ring-orange-500 outline-none"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </form>
          ) : (
            <span className="font-medium truncate">{name}</span>
          )}
        </div>
        <span className="text-xs opacity-60 ml-2">{count}</span>
      </div>

      {onRename && !isEditing && (
        <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            className="p-1 text-zinc-400 hover:text-purple-500"
          >
            <Edit2 size={12} />
          </button>
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1 text-zinc-400 hover:text-red-500"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SortableInsightCard({ insight, onDelete, onUpdateName, onDevelop, onUndo }: {
  key?: React.Key;
  insight: ProfessorInsight,
  onDelete: (id: string) => void | Promise<void>,
  onUpdateName: (id: string, name: string) => void | Promise<void>,
  onDevelop: (id: string, text: string, image?: string) => void | Promise<void>,
  onUndo: (id: string) => void | Promise<void>
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: insight.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : 1
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(insight.professorName || '');
  const [isDeveloping, setIsDeveloping] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [devText, setDevText] = useState('');
  const [devImage, setDevImage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSave = () => {
    onUpdateName(insight.id, editName);
    setIsEditing(false);
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      layout
      className="glass p-8 rounded-[40px] border border-white/40 shadow-xl hover:shadow-2xl transition-all group relative"
    >
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <div
            {...attributes}
            {...listeners}
            className="p-2 text-zinc-300 hover:text-zinc-500 cursor-grab active:cursor-grabbing transition-colors"
          >
            <GripVertical size={20} />
          </div>
          <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-white shadow-lg relative">
            {isUpdating ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              >
                <Loader2 size={24} />
              </motion.div>
            ) : (
              <UserIcon size={28} />
            )}
          </div>
          <div>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-zinc-100 border-none rounded-lg px-3 py-1 text-lg font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                  autoFocus
                />
                <button onClick={handleSave} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded-md">
                  <Save size={18} />
                </button>
                <button onClick={() => { setIsEditing(false); setEditName(insight.professorName || ''); }} className="p-1 text-red-500 hover:bg-red-50 rounded-md">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group/name">
                <h3 className="text-2xl font-bold text-zinc-900">{insight.professorName}</h3>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 text-zinc-300 hover:text-zinc-600 opacity-0 group-hover/name:opacity-100 transition-all"
                >
                  <Edit2 size={16} />
                </button>
              </div>
            )}
            <p className="text-zinc-400 text-xs font-medium uppercase tracking-widest mt-1">Professor Insight</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {insight.history && insight.history.length > 0 && (
            <button
              onClick={() => onUndo(insight.id)}
              title="이전 버전으로 되돌리기"
              className="p-3 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded-2xl transition-all"
            >
              <RotateCcw size={20} />
            </button>
          )}
          <button
            onClick={() => onDelete(insight.id)}
            className="p-3 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {isUpdating ? (
          <div className="py-12 flex flex-col items-center justify-center gap-6">
            <div className="text-center space-y-3">
              <p className="text-xl font-bold text-zinc-900">교수님의 의도를 파악 중입니다</p>
              <div className="flex justify-center gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ y: [0, -6, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                    className="w-2 h-2 bg-purple-500 rounded-full"
                  />
                ))}
              </div>
              <p className="text-zinc-400 text-sm font-medium mt-4">
                새로운 정보를 바탕으로 인사이트를 정교화하고 있습니다...
              </p>
            </div>
          </div>
        ) : (
          <>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden space-y-6"
                >
                  <div className="bg-zinc-50/50 p-6 rounded-3xl border border-zinc-100">
                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest mb-3">Teaching Style</p>
                    <p className="text-zinc-700 leading-relaxed">{insight.style}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">Key Points</p>
                      <div className="flex flex-wrap gap-2">
                        {insight.points.map((point, i) => (
                          <span key={i} className="bg-white px-4 py-2 rounded-2xl text-xs font-medium text-zinc-600 border border-zinc-100 shadow-sm">
                            {point}
                          </span>
                        ))}
                      </div>
                    </div>

                    {insight.redFlags && insight.redFlags.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <AlertCircle size={14} className="text-red-500" />
                          <p className="text-[10px] text-red-500 uppercase font-bold tracking-widest">Red Flags</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {insight.redFlags.map((flag, i) => (
                            <span key={i} className="bg-red-50 px-4 py-2 rounded-2xl text-xs font-medium text-red-600 border border-red-100">
                              {flag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {insight.preferredStyles && insight.preferredStyles.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Palette size={14} className="text-purple-500" />
                        <p className="text-[10px] text-purple-500 uppercase font-bold tracking-widest">Preferred Styles</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {insight.preferredStyles.map((style, i) => (
                          <span key={i} className="bg-purple-50 px-4 py-2 rounded-2xl text-xs font-medium text-purple-600 border border-purple-100">
                            {style}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-6 border-t border-zinc-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={16} className="text-orange-500" />
                      <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">Winning Strategy</p>
                    </div>
                    <p className="text-sm text-zinc-800 font-medium leading-relaxed bg-orange-50 p-4 rounded-2xl border border-orange-100">
                      {insight.strategy}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-4 pt-4 border-t border-zinc-100">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex-1 py-2 flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-all"
              >
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>
          </>
        )}

        <div className="pt-6 border-t border-zinc-100">
          {!isDeveloping ? (
            <button
              onClick={() => setIsDeveloping(true)}
              className="w-full py-3 rounded-2xl border border-dashed border-zinc-200 text-zinc-400 text-xs font-bold uppercase tracking-widest hover:border-purple-300 hover:text-purple-500 hover:bg-purple-50 transition-all flex items-center justify-center gap-2"
            >
              <Plus size={14} />
              자료 추가 및 디벨롭
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4"
            >
              <textarea
                value={devText}
                onChange={(e) => setDevText(e.target.value)}
                placeholder="추가할 메모나 피드백을 적어주세요..."
                className="w-full bg-zinc-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none h-24"
              />

              <div className="flex items-center gap-4">
                {devImage ? (
                  <div className="relative w-16 h-16">
                    <img src={devImage} className="w-full h-full object-cover rounded-xl border border-zinc-200" />
                    <button
                      onClick={() => setDevImage(null)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white p-0.5 rounded-full"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer bg-zinc-100 hover:bg-zinc-200 p-3 rounded-xl transition-all text-zinc-500">
                    <Upload size={18} />
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => setDevImage(ev.target?.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                )}

                <div className="flex-1 flex gap-2">
                  <button
                    onClick={async () => {
                      if (devText || devImage) {
                        setIsUpdating(true);
                        try {
                          await onDevelop(insight.id, devText, devImage || undefined);
                        } finally {
                          setIsUpdating(false);
                          setDevText('');
                          setDevImage(null);
                          setIsDeveloping(false);
                        }
                      }
                    }}
                    className="flex-1 bg-purple-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-purple-700 transition-all disabled:opacity-50"
                    disabled={isUpdating}
                  >
                    {isUpdating ? '분석 중...' : '업데이트'}
                  </button>
                  <button
                    onClick={() => {
                      setIsDeveloping(false);
                      setDevText('');
                      setDevImage(null);
                    }}
                    className="px-4 py-2 rounded-xl border border-zinc-200 text-zinc-500 text-xs font-bold hover:bg-zinc-50 transition-all"
                  >
                    취소
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface AssignmentCardProps {
  key?: React.Key;
  assignment: Assignment;
  onDelete: (id: string) => void;
  onToggleStep: (aid: string, sid: string) => void;
}

function AssignmentCard({ assignment, onDelete, onToggleStep }: AssignmentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const completedCount = assignment.steps.filter(s => s.completed).length;
  const progress = (completedCount / assignment.steps.length) * 100;

  const calculateDDay = (deadline: string) => {
    if (!deadline) return null;
    const target = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'D-Day';
    if (diffDays > 0) return `D-${diffDays}`;
    return `D+${Math.abs(diffDays)}`;
  };

  const dDay = calculateDDay(assignment.deadline || '');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.8 }}
      transition={{ duration: 0.4 }}
      className="glass rounded-[40px] overflow-hidden group hover:shadow-2xl transition-all duration-500 flex flex-col"
    >
      <div className={cn("p-10 space-y-6 transition-all duration-500", !isExpanded && "p-8 space-y-4")}>
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-bold text-zinc-900">{assignment.title}</h3>
              {dDay && (
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm",
                  dDay.startsWith('D-') || dDay === 'D-Day' ? "bg-orange-500 text-white" : "bg-zinc-200 text-zinc-500"
                )}>
                  {dDay}
                </span>
              )}
            </div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
              {new Date(assignment.createdAt).toLocaleDateString()} 생성 {assignment.deadline && `| 마감: ${assignment.deadline}`}
            </p>
          </div>
          <button
            onClick={() => onDelete(assignment.id)}
            className="text-zinc-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={20} />
          </button>
        </div>

        <Progress3D progress={progress} />

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden space-y-8"
            >
              <div className="space-y-4">
                <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Action Steps</p>
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {assignment.steps.map(step => (
                      <motion.button
                        key={step.id}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        onClick={() => onToggleStep(assignment.id, step.id)}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-2xl text-left text-sm transition-all border",
                          step.completed
                            ? "bg-white/20 text-zinc-400 line-through border-transparent"
                            : "bg-white/60 text-zinc-700 hover:bg-white border-white/40 shadow-sm"
                        )}
                      >
                        {step.completed ? <CheckCircle2 size={18} className="text-orange-500" /> : <Clock size={18} className="text-zinc-300" />}
                        <span className="flex-1">{step.text}</span>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {assignment.direction && (
                <div className="pt-4 border-t border-white/20 space-y-4">
                  <div>
                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider mb-2">Strategy</p>
                    <p className="text-sm text-zinc-600 leading-relaxed italic">"{assignment.direction}"</p>
                  </div>

                  {assignment.cheerMessage && (
                    <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10 flex items-start gap-3">
                      <div className="w-8 h-8 bg-emerald-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                      </div>
                      <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                        {assignment.cheerMessage}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {assignment.references.map((ref, i) => (
                      <span key={i} className="text-[10px] bg-white/60 text-zinc-500 px-3 py-1 rounded-full border border-white/40 shadow-sm">#{ref}</span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full py-2 flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-all border-t border-white/10 mt-4"
        >
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>
    </motion.div>
  );
}
