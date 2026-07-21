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
"""
Tests for ``scripts/translations/strip_percent_format_flags.py``.

The script is not installed as a package, so it is loaded via importlib from
its on-disk path.
"""

import importlib.util
from pathlib import Path

_SCRIPT_PATH = (
    Path(__file__).resolve().parents[4]
    / "scripts"
    / "translations"
    / "strip_percent_format_flags.py"
)
_spec = importlib.util.spec_from_file_location(
    "strip_percent_format_flags", _SCRIPT_PATH
)
assert _spec is not None, f"Could not load {_SCRIPT_PATH}"
assert _spec.loader is not None, f"No loader on spec for {_SCRIPT_PATH}"
strip_percent_format_flags = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(strip_percent_format_flags)


def _lines(text: str) -> list[str]:
    return text.splitlines(keepends=True)


def test_bare_python_format_flag_line_is_deleted() -> None:
    lines = _lines('#, python-format\nmsgid "% calculation"\nmsgstr ""\n')
    changed = strip_percent_format_flags.strip_flag_lines(lines)
    assert changed == 1
    assert "".join(lines) == 'msgid "% calculation"\nmsgstr ""\n'


def test_flag_alongside_fuzzy_drops_python_format_and_keeps_fuzzy() -> None:
    lines = _lines('#, fuzzy, python-format\nmsgid "% of parent"\nmsgstr ""\n')
    changed = strip_percent_format_flags.strip_flag_lines(lines)
    assert changed == 1
    assert lines[0] == "#, fuzzy\n"


def test_real_python_format_msgid_is_untouched() -> None:
    text = (
        "#, python-format\n"
        'msgid "%(dialect)s cannot be used as a data source for security reasons."\n'
        'msgstr ""\n'
    )
    lines = _lines(text)
    changed = strip_percent_format_flags.strip_flag_lines(lines)
    assert changed == 0
    assert "".join(lines) == text


def test_existing_no_python_format_flag_line_is_deleted() -> None:
    lines = _lines('#, no-python-format\nmsgid "% of total"\nmsgstr ""\n')
    changed = strip_percent_format_flags.strip_flag_lines(lines)
    assert changed == 1
    assert "".join(lines) == 'msgid "% of total"\nmsgstr ""\n'


def test_target_msgid_without_flag_line_is_untouched() -> None:
    text = 'msgid "% calculation"\nmsgstr ""\n'
    lines = _lines(text)
    changed = strip_percent_format_flags.strip_flag_lines(lines)
    assert changed == 0
    assert "".join(lines) == text


def test_process_file_round_trip(tmp_path: Path) -> None:
    pot = tmp_path / "messages.pot"
    pot.write_text(
        '#, python-format\nmsgid "% calculation"\nmsgstr ""\n\n'
        '#, python-format\nmsgid "% of parent"\nmsgstr ""\n\n'
        '#, python-format\nmsgid "%(name)s.csv"\nmsgstr ""\n',
        encoding="utf-8",
    )
    changed = strip_percent_format_flags.process_file(pot)
    assert changed == 2
    result = pot.read_text(encoding="utf-8")
    # The two literal-% labels lose the flag comment; the real format string is
    # kept.
    assert '#, python-format\nmsgid "% calculation"' not in result
    assert '#, python-format\nmsgid "% of parent"' not in result
    assert "no-python-format" not in result
    assert '#, python-format\nmsgid "%(name)s.csv"' in result


def test_process_file_is_idempotent(tmp_path: Path) -> None:
    pot = tmp_path / "messages.pot"
    pot.write_text(
        '#, python-format\nmsgid "% calculation"\nmsgstr ""\n',
        encoding="utf-8",
    )
    assert strip_percent_format_flags.process_file(pot) == 1
    assert strip_percent_format_flags.process_file(pot) == 0


def test_committed_catalogs_carry_no_spurious_flag() -> None:
    """Regression guard: the shipped .pot/.po must not flag the literal-%
    UI labels as (no-)python-format (msgfmt fatals on them otherwise, and the
    comment is noise on these literal-percent labels)."""
    targets = {f'msgid "{m}"' for m in strip_percent_format_flags.TARGET_MSGIDS}
    for path in strip_percent_format_flags.default_paths():
        if not path.exists():
            continue
        lines = path.read_text(encoding="utf-8").splitlines()
        for i, line in enumerate(lines):
            if line in targets and i > 0 and lines[i - 1].startswith("#,"):
                tokens = [t.strip() for t in lines[i - 1][2:].split(",")]
                assert not strip_percent_format_flags.SPURIOUS_FLAGS.intersection(
                    tokens
                ), f"{path} flags {line!r} as (no-)python-format"
