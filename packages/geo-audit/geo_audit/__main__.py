"""python -m geo_audit quick <url>"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys

from geo_audit.service import GeoAuditService


def main() -> None:
    parser = argparse.ArgumentParser(prog="geo-audit")
    sub = parser.add_subparsers(dest="cmd", required=True)
    quick = sub.add_parser(
        "quick", help="Run quick GEO audit (native or GEO_SEO_CLAUDE_HOME scripts)"
    )
    quick.add_argument("url")
    args = parser.parse_args()
    if args.cmd == "quick":
        result = asyncio.run(GeoAuditService().run_quick_audit(args.url))
        sys.stdout.write(json.dumps(result.model_dump(), indent=2, ensure_ascii=False))
        sys.stdout.write("\n")


if __name__ == "__main__":
    main()
