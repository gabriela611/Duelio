import type { ISocialRepository } from "../../domain/social/socialRepository.ts";
import { FileSocialRepository } from "./FileSocialRepository.ts";
import { SupabaseSocialRepository } from "./SupabaseSocialRepository.ts";
import { ShadowSocialRepository } from "./ShadowSocialRepository.ts";

let activeSocialRepository: ISocialRepository | null = null;

/**
 * Returns the active social repository instance.
 * - "supabase" (default): SupabaseSocialRepository (canonical cloud database)
 * - "shadow": ShadowSocialRepository (primary file store, shadow reading Supabase)
 * - "file": FileSocialRepository (.data/social_store.json - deprecated legacy store)
 */
export function getSocialRepository(): ISocialRepository {
  if (!activeSocialRepository) {
    const backend = process.env.DATA_BACKEND || "supabase";
    if (backend === "file") {
      activeSocialRepository = new FileSocialRepository();
    } else if (backend === "shadow") {
      activeSocialRepository = new ShadowSocialRepository(
        new FileSocialRepository(),
        new SupabaseSocialRepository()
      );
    } else {
      activeSocialRepository = new SupabaseSocialRepository();
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

export { FileSocialRepository, SupabaseSocialRepository, ShadowSocialRepository };
export type { ISocialRepository };

