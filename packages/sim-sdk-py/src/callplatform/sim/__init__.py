"""Deterministic in-process sim runtime for the BYO agent SDK.

See ``callplatform.sim.runtime.SimulatedRoom``.
"""

from .runtime import SimulatedRoom, silence_frame

__all__ = ["SimulatedRoom", "silence_frame"]
