#!/usr/bin/env python3
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""Drop spurious ``python-format`` flags from %-prefixed UI labels.

A few UI labels ("% calculation", "% of parent", "% of total") parse as
accidentally-valid ``%``-format directives -- a space flag followed by a
conversion character (``% c``) -- so Babel auto-flags them ``python-format``
on every extract/update. The app never ``%``-formats these strings, and
``msgfmt`` fatals on their translations when the flag is present. Rewrite the
flag to ``no-python-format`` so gettext tooling treats them as literal text.

Run from ``babel_update.sh`` AFTER ``pybabel update`` (Babel re-adds the flag
during the update pass, so this must run last). Edits are line-targeted so the
.pot/.po canonical wrapping is untouched. Idempotent: re-running makes no
further changes.

Usage:
  python scripts/translations/strip_percent_format_flags.py [PATH ...]
  # With no args, processes messages.pot and every language catalog.
"""

from __future__ import annotations

import sys
from pathlib import Path

TRANSLATIONS_DIR: Path = (
    Path(__file__).parent.parent.parent / "superset" / "translations"
)

# msgids whose leading ``%`` is a literal percent sign, not a format directive.
TARGET_MSGIDS: frozenset[str] = frozenset(
    {"% calculation", "% of parent", "% of total"}
)


def rewrite_lines(lines: list[str]) -> int:
    """Rewrite ``python-format`` to ``no-python-format`` on the flag line above
    each target msgid, mutating ``lines`` in place. Returns the number of
    entries changed.
    """
    targets: set[str] = {f'msgid "{msgid}"' for msgid in TARGET_MSGIDS}
    changed: int = 0
    for i, line in enumerate(lines):
        if i == 0 or line.rstrip("\n") not in targets:
            continue
        prev: str = lines[i - 1]
        if not prev.startswith("#,"):
            continue
        tokens: list[str] = [t.strip() for t in prev.rstrip("\n")[2:].split(",")]
        if "python-format" not in tokens:
            continue
        tokens = [t for t in tokens if t != "python-format"]
        if "no-python-format" not in tokens:
            tokens.append("no-python-format")
        eol: str = "\n" if prev.endswith("\n") else ""
        lines[i - 1] = "#, " + ", ".join(tokens) + eol
        changed += 1
    return changed


def process_file(path: Path) -> int:
    """Apply the rewrite to a single .pot/.po file. Returns entries changed."""
    lines: list[str] = path.read_text(encoding="utf-8").splitlines(keepends=True)
    changed: int = rewrite_lines(lines)
    if changed:
        path.write_text("".join(lines), encoding="utf-8")
    return changed


def default_paths() -> list[Path]:
    """The .pot plus every language catalog, matching babel_update.sh."""
    pot: Path = TRANSLATIONS_DIR / "messages.pot"
    catalogs: list[Path] = sorted(TRANSLATIONS_DIR.glob("*/LC_MESSAGES/messages.po"))
    return [pot, *catalogs]


def main() -> None:
    """Strip the spurious flag from the given paths (or the defaults)."""
    args: list[str] = sys.argv[1:]
    paths: list[Path] = [Path(a) for a in args] if args else default_paths()
    total: int = 0
    for path in paths:
        if not path.exists():
            continue
        total += process_file(path)
    print(
        f"strip-percent-format-flags: rewrote {total} entr(y/ies) across "
        f"{len(paths)} file(s).",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
