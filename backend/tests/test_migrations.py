"""Migrations form one chain: unique ids and a single head (otherwise the deployment's upgrade fails)."""

import re
from pathlib import Path

VERSIONS = Path(__file__).resolve().parent.parent / "alembic" / "versions"


def test_revision_ids_are_unique_and_there_is_one_head():
    revisions, parents = [], set()
    for path in VERSIONS.glob("*.py"):
        text = path.read_text(encoding="utf-8")
        revisions.append(re.search(r'^revision[^=]*=\s*["\']([^"\']+)', text, re.M).group(1))
        down = re.search(r"^down_revision[^=]*=\s*(.+)$", text, re.M).group(1)
        parents.update(re.findall(r"[\"']([0-9a-z_]+)[\"']", down))
    duplicates = {r for r in revisions if revisions.count(r) > 1}
    assert not duplicates, f"revision ids used twice: {duplicates}"
    heads = [r for r in revisions if r not in parents]
    assert len(heads) == 1, f"several heads: {heads}"
