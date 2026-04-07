export type {
  Answer,
  AnswerDetail,
  Mention,
  Citation,
  AnswerVisibilityScore as VisibilityScore,
} from "./api";

// Explorer rows currently mirror the detailed API payload.
export type AnswerExplorerItem = import("./api").AnswerDetail;
