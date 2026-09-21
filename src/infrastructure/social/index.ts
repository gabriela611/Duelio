import type { ISocialRepository } from "../../domain/social/socialRepository.ts";
import { FileSocialRepository } from "./FileSocialRepository.ts";

let activeSocialRepository: ISocialRepository | null = null;

/**
 * Returns the active social repository instance.
 * Defaults to FileSocialRepository, but can be switched to SupabaseSocialRepository
 * or a DualShadowSocialRepository via feature flag or dependency injection.
 */
export function getSocialRepository(): ISocialRepository {
  if (!activeSocialRepository) {
    activeSocialRepository = new FileSocialRepository();
  }
  return activeSocialRepository;
}

/**
 * Override repository instance for testing, shadow reads, or runtime cutover.
 */
export function setSocialRepository(repo: ISocialRepository | null): void {
  activeSocialRepository = repo;
}

export { FileSocialRepository };
export type { ISocialRepository };
