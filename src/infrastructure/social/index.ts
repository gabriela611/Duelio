import type { ISocialRepository } from "../../domain/social/socialRepository.ts";
import { FileSocialRepository } from "./FileSocialRepository.ts";
import { SupabaseSocialRepository } from "./SupabaseSocialRepository.ts";
import { ShadowSocialRepository } from "./ShadowSocialRepository.ts";

let activeSocialRepository: ISocialRepository | null = null;

/**
 * Returns the active social repository instance.
 * - "supabase": SupabaseSocialRepository (direct cloud database)
 * - "shadow": ShadowSocialRepository (primary file store, shadow reading Supabase)
 * - default: FileSocialRepository (.data/social_store.json)
 */
export function getSocialRepository(): ISocialRepository {
  if (!activeSocialRepository) {
    if (process.env.DATA_BACKEND === "supabase") {
      activeSocialRepository = new SupabaseSocialRepository();
    } else if (process.env.DATA_BACKEND === "shadow") {
      activeSocialRepository = new ShadowSocialRepository(
        new FileSocialRepository(),
        new SupabaseSocialRepository()
      );
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

export { FileSocialRepository, SupabaseSocialRepository, ShadowSocialRepository };
export type { ISocialRepository };

