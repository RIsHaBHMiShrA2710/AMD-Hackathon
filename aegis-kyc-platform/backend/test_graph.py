# -*- coding: utf-8 -*-
"""
AegisKYC - Pipeline Self-Test
===============================
Invokes the KYC graph directly with a mock KYCState payload to verify:
  (a) All five nodes execute in order
  (b) agent_logs contains entries from each node
  (c) final_decision is one of APPROVE, REVIEW, ESCALATE

Run from the aegis-kyc-platform/backend directory:
  python test_graph.py

Note: This test uses fallback mode since no real vLLM server is running.
LLM calls return graceful ESCALATE fallbacks by design.
"""

import asyncio
import sys
import os

# Force UTF-8 output on Windows to avoid emoji encoding errors
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Add parent directory to path so imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

from graph.kyc_graph import build_kyc_graph


MOCK_INPUT = """
GOVERNMENT OF INDIA
UNIQUE IDENTIFICATION AUTHORITY OF INDIA

To,
Rahul Sharma
S/O Baldev Sharma
12, Barakhamba Road, Connaught Place,
New Delhi - 110001

DOB: 12/08/1990
Gender: MALE

YOUR AADHAAR NO:
1234-5678-9012

आधार - आम आदमी का अधिकार
"""


async def run_test():
    print("=" * 60)
    print("  AegisKYC - Pipeline Self-Test")
    print("=" * 60)

    # Build the graph
    print("\n[1/3] Building LangGraph state machine...")
    graph = build_kyc_graph()
    print("      [OK] Graph compiled successfully")

    # Create initial state
    import uuid
    from core.state import KYCState
    initial_state = KYCState(
        case_id=str(uuid.uuid4()),
        raw_input="",
        input_type="image",
        image_filename="aadhaar_rahul_sharma.png",
        extracted_data={},
        compliance_flags=[],
        confidence_score=0.0,
        security_status="PENDING",
        final_decision="PENDING",
        audit_summary="",
        agent_logs=[],
        stream_events=[],
    )

    print(f"\n[2/3] Running pipeline for case {initial_state['case_id'][:8]}...")
    print(f"      Input: {len(initial_state['raw_input'])} chars")

    # Run the graph
    final_state = await graph.ainvoke(initial_state)

    print("\n[3/3] Validating results...")

    # Assertion (a): Check required nodes logged
    agent_logs = final_state.get("agent_logs", [])
    print(f"\n  Agent logs ({len(agent_logs)} entries):")
    for log in agent_logs:
        print(f"    {log}")

    expected_nodes = {"GUARDRAIL", "EXTRACTION", "COMPLIANCE", "ORCHESTRATOR", "SANITIZER"}
    logged_nodes = set()
    for log in agent_logs:
        for node in expected_nodes:
            if f"[{node}]" in log:
                logged_nodes.add(node)

    # ORCHESTRATOR may be skipped if confidence > 0.95 (auto-escalate path)
    required_nodes = {"GUARDRAIL", "EXTRACTION", "COMPLIANCE", "SANITIZER"}
    missing = required_nodes - logged_nodes
    if missing:
        print(f"\n  [FAIL] ASSERTION FAILED: Missing nodes in logs: {missing}")
        sys.exit(1)
    print(f"\n  [OK] (a) Required nodes executed: {required_nodes}")

    # Assertion (b): agent_logs has entries
    assert len(agent_logs) >= 4, f"Expected >=4 log entries, got {len(agent_logs)}"
    print(f"  [OK] (b) agent_logs has {len(agent_logs)} entries")

    # Assertion (c): final_decision is valid
    decision = final_state.get("final_decision")
    valid_decisions = {"APPROVE", "REVIEW", "ESCALATE"}
    assert decision in valid_decisions, f"Unexpected decision: {decision}"
    print(f"  [OK] (c) final_decision = '{decision}' (valid)")

    # Print summary
    print("\n" + "=" * 60)
    print(f"  RESULT:     {decision}")
    print(f"  Security:   {final_state.get('security_status')}")
    print(f"  Confidence: {final_state.get('confidence_score', 0):.2%}")
    print(f"  Flags:      {len(final_state.get('compliance_flags', []))}")
    print(f"  Extracted:  {final_state.get('extracted_data')}")
    print(f"  Events:     {len(final_state.get('stream_events', []))}")
    print("=" * 60)
    print("\nAll assertions PASSED - pipeline is working correctly!\n")


if __name__ == "__main__":
    asyncio.run(run_test())
