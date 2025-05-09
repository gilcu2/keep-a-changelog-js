import { equals, parse } from "./deps.ts";
import type Release from "./Release.ts";
import type { SemVer } from "./deps.ts";

export default class Changelog {
  flag?: string;
  title: string;
  description: string;
  head = "HEAD";
  footer?: string;
  url?: string;
  releases: Release[] = [];
  tagNameBuilder?: (release: Release) => string;
  /** @deprecated: Use tagLinkBuilder() instead */
  compareLinkBuilder?: (previous: Release, release: Release) => string;
  tagLinkBuilder?: (
    url: string,
    tag: string,
    previous?: string,
    head?: string,
  ) => string;
  format: "compact" | "markdownlint" = "compact";
  bulletStyle: "-" | "*" | "+" = "-";
  autoSortReleases = true;

  constructor(title: string, description = "") {
    this.title = title;
    this.description = description;
  }

  addRelease(release: Release): this {
    this.releases.push(release);
    if (this.autoSortReleases) {
      this.sortReleases();
    }
    release.changelog = this;

    return this;
  }

  findRelease(version?: SemVer | string): Release | undefined {
    if (!version) {
      return this.releases.find((release) => !release.version);
    }
    const parsed = typeof version === "string" ? parse(version) : version;

    return this.releases.find((release) =>
      release.parsedVersion && equals(release.parsedVersion, parsed)
    );
  }

  sortReleases(): void {
    this.releases.sort((a, b) => a.compare(b));
  }

  compareLink(previous: Release, release: Release): string {
    if (this.compareLinkBuilder) {
      return this.compareLinkBuilder(previous, release);
    }

    if (this.tagLinkBuilder) {
      const url = this.url!;

      if (!previous) {
        return this.tagLinkBuilder(
          this.url!,
          this.tagName(release),
          undefined,
          this.head,
        );
      }

      if (!release.date || !release.version) {
        return this.tagLinkBuilder(
          url,
          this.head,
          this.tagName(previous),
          this.head,
        );
      }

      return this.tagLinkBuilder(
        url,
        this.tagName(release),
        this.tagName(previous),
        this.head,
      );
    }

    if (!previous) {
      return `${this.url}/releases/tag/${this.tagName(release)}`;
    }

    if (!release.date || !release.version) {
      return `${this.url}/compare/${this.tagName(previous)}...${this.head}`;
    }

    return `${this.url}/compare/${this.tagName(previous)}...${
      this.tagName(release)
    }`;
  }

  tagName(release: Release): string {
    if (this.tagNameBuilder) {
      return this.tagNameBuilder(release);
    }

    return `v${release.version}`;
  }

  toString(): string {
    const t = [];

    if (this.flag) {
      t.push(`<!-- ${this.flag} -->`);
      t.push("");
    }

    t.push(`# ${this.title}`);

    if (this.format === "markdownlint") {
      t.push("");
    }

    const links: string[] = [];
    const compareLinks: string[] = [];

    const description = this.description.trim() ||
      `All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/)
and this project adheres to [Semantic Versioning](https://semver.org/).`;

    if (description) {
      t.push(description);
    }

    this.releases.forEach((release) => {
      t.push("");
      t.push(release.toString(this));

      release.getLinks(this).forEach((link) => {
        if (!links.includes(link)) {
          links.push(link);
        }
      });

      const compareLink = release.getCompareLink(this);

      if (compareLink) {
        compareLinks.push(compareLink);
      }
    });

    if (links.length) {
      t.push("");
      links.sort(compare);
      links.forEach((link) => t.push(link));
    }

    if (compareLinks.length) {
      t.push("");

      compareLinks.forEach((link) => t.push(link));
    }

    t.push("");

    if (this.footer) {
      t.push("---");
      t.push("");
      t.push(this.footer);
      t.push("");
    }

    return t.join("\n");
  }
}

function compare(a: string, b: string) {
  if (a === b) {
    return 0;
  }
  const reg = /^\[#(\d+)\]:/;
  const aNumber = a.match(reg);
  const bNumber = b.match(reg);

  if (aNumber && bNumber) {
    return parseInt(aNumber[1]) - parseInt(bNumber[1]);
  }

  return a < b ? -1 : 1;
}
