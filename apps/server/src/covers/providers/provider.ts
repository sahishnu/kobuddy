import type {
  CoverCandidate,
  CoverProviderName,
  IsbnCandidate,
} from '@kobuddy/common';

/** Inputs shared by provider search helpers (ISBN lookup may be omitted). */
export type CoverSearchInput = {
  title: string;
  authors: string;
  isbn?: string | null;
  googleBooksApiKey?: string;
};

/** Maps one external metadata API to our wire DTOs. */
export interface CoverProvider {
  readonly name: CoverProviderName;
  searchCoverCandidates(input: CoverSearchInput): Promise<CoverCandidate[]>;
  searchIsbnCandidates(input: CoverSearchInput): Promise<IsbnCandidate[]>;
  fetchCoverBytes(
    candidate: CoverCandidate,
    googleBooksApiKey?: string,
  ): Promise<Buffer | null>;
}
