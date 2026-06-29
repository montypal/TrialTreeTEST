import { ReviewClient } from './ReviewClient';

// Manual-approval queue for AI actions that scored below the auto-apply
// confidence threshold (or failed to resolve a target).
export default function ReviewPage() {
  return <ReviewClient />;
}
