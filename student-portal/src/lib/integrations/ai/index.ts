/**
 * Interfaces for planned AI features (Section 40). NOTHING HERE IS IMPLEMENTED: these types define
 * the seams so features can be added without restructuring. Calls to model providers must run
 * server-side (Edge Functions) with RLS-scoped data and an audit entry per request.
 */
export interface AiContext {
  studentId: string
  locale?: string
}

export interface StudentAssistant {
  ask(
    question: string,
    ctx: AiContext,
  ): Promise<{ answer: string; sources: { title: string; link: string }[] }>
}

export interface IeltsTutor {
  scoreWriting(
    task: 'task1' | 'task2',
    essay: string,
  ): Promise<{ band: number; criteria: Record<string, number>; feedback: string }>
}

export interface SopReviewer {
  review(
    text: string,
    program: { name: string; university: string },
  ): Promise<{ summary: string; suggestions: string[] }>
}

export interface ChecklistGenerator {
  suggest(applicationId: string): Promise<{ documentTypeKey: string; reason: string }[]>
}

export interface UniversityMatcher {
  recommend(
    ctx: AiContext,
    limit?: number,
  ): Promise<{ programId: string; score: number; reasons: string[] }[]>
}

export interface DocumentClassifier {
  /** Result is stored in documents.ai_classification for staff to confirm. */
  classify(
    documentId: string,
  ): Promise<{ documentTypeKey: string; confidence: number; extracted: Record<string, string> }>
}

export interface FaqAssistant {
  answer(question: string): Promise<{ answer: string; faqIds: string[] }>
}

export interface AiServices {
  assistant?: StudentAssistant
  ieltsTutor?: IeltsTutor
  sopReviewer?: SopReviewer
  checklist?: ChecklistGenerator
  matcher?: UniversityMatcher
  classifier?: DocumentClassifier
  faq?: FaqAssistant
}

/** Empty until implemented — features check for presence before showing AI UI. */
export const aiServices: AiServices = {}
