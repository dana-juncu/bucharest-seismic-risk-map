"""
Step 1 of the data pipeline: pull the live AMCCRS seismic-risk building
registry via the RoPublicData MCP server and save it as raw JSON.

This project doesn't hardcode a snapshot of the data -- it re-pulls live
from AMCCRS's own registry each time the map is rebuilt, via RoPublicData
(https://github.com/dana-juncu/ro-public-data), a keyless MCP server for
Romanian public data.

Run this with an MCP client connected to RoPublicData (e.g. Claude Desktop,
or any other MCP-capable client). It's written as a thin wrapper so the
exact call is documented -- adapt the client setup to whichever MCP client
you're using.
"""
import json

# Pseudocode / reference call -- replace with your MCP client's call syntax.
# Tool: amccrs_search_buildings
# Params: {} (no filters -> returns everything), limit set high enough to
#   get the full registry (2,796 buildings as of the last pull; check
#   `total_matches` in the response and re-run with a higher `limit` if it
#   grows).
#
# result = mcp_client.call_tool(
#     "amccrs_search_buildings",
#     {"limit": 5000},
# )
#
# with open("amccrs_raw.json", "w", encoding="utf-8") as f:
#     json.dump(result, f, ensure_ascii=False, indent=2)
#
# print(f"Saved {len(result['buildings'])} buildings to amccrs_raw.json")

if __name__ == "__main__":
    raise SystemExit(
        "This script documents the MCP call used to produce amccrs_raw.json "
        "-- it isn't meant to run standalone. Point an MCP client at "
        "RoPublicData's amccrs_search_buildings tool (see the docstring "
        "above) and save its output as amccrs_raw.json in this folder, "
        "then run parse_and_normalize.py."
    )
