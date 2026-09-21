import type { ISocialRepository } from "../../domain/social/socialRepository.ts";
import { FileSocialRepository } from "./FileSocialRepository.ts";
import { SupabaseSocialRepository } from "./SupabaseSocialRepository.ts";

let activeSocialRepository: ISocialRepository | null = null;

/**
 * Returns the active social repository instance.
 * Defaults to FileSocialRepository, but switches to SupabaseSocialRepository
 * when process.env.DATA_BACKEND === "supabase".
 */
export function getSocialRepository(): ISocialRepository {
  if (!activeSocialRepository) {
    if (process.env.DATA_BACKEND === "supabase") {
      activeSocialRepository = new SupabaseSocialRepository();
    } else {
      activeSocialRepository = new FileSocialRepository();
    }
  }
  return activeSocialRepository;
}

/**
 * Override repository instance for testing, shadow reads, or runtime cutover.
 */
export function setSocialRepository(repo: ISocialRepository | null): void {
  activeSocialRepository = repo;
}

export { FileSocialRepository, SupabaseSocialRepository };
export type { ISocialRepository };
