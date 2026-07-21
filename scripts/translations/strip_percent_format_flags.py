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
``msgfmt`` fatals on their translations when the flag is present. Delete the
spurious flag entirely so the catalogs carry no ``(no-)python-format`` comment
on these literal-percent labels.

The whole ``#,`` line is removed when the flag was its only token; any
unrelated flags on the same line (e.g. ``fuzzy``) are preserved.

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

# Flag tokens to strip from the ``#,`` line above a target msgid.
SPURIOUS_FLAGS: frozenset[str] = frozenset({"python-format", "no-python-format"})


def strip_flag_lines(lines: list[str]) -> int:
    """Delete the spurious ``(no-)python-format`` flag on the ``#,`` line above
    each target msgid, mutating ``lines`` in place. The whole line is removed
    when the flag was its only token; other flags are kept. Returns the number
    of entries changed.
    """
    targets: set[str] = {f'msgid "{msgid}"' for msgid in TARGET_MSGIDS}
    out: list[str] = []
    changed: int = 0
    i: int = 0
    n: int = len(lines)
    while i < n:
        line: str = lines[i]
        if line.startswith("#,") and i + 1 < n and lines[i + 1].rstrip("\n") in targets:
            tokens: list[str] = [t.strip() for t in line.rstrip("\n")[2:].split(",")]
            if SPURIOUS_FLAGS.intersection(tokens):
                remaining: list[str] = [t for t in tokens if t not in SPURIOUS_FLAGS]
                changed += 1
                if remaining:
                    eol: str = "\n" if line.endswith("\n") else ""
                    out.append("#, " + ", ".join(remaining) + eol)
                # else: drop the flag line entirely.
                i += 1
                continue
        out.append(line)
        i += 1
    lines[:] = out
    return changed


def process_file(path: Path) -> int:
    """Apply the strip to a single .pot/.po file. Returns entries changed."""
    lines: list[str] = path.read_text(encoding="utf-8").splitlines(keepends=True)
    changed: int = strip_flag_lines(lines)
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
        f"strip-percent-format-flags: stripped {total} entr(y/ies) across "
        f"{len(paths)} file(s).",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
