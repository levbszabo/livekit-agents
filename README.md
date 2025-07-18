<!--BEGIN_BANNER_IMAGE-->

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="/.github/banner_dark.png">
  <source media="(prefers-color-scheme: light)" srcset="/.github/banner_light.png">
  <img style="width:100%;" alt="The LiveKit icon, the name of the repository and some sample code in the background." src="https://raw.githubusercontent.com/livekit/agent-playground/main/.github/banner_light.png">
</picture>

<!--END_BANNER_IMAGE-->

# DotBridge Research Framework - LiveKit Agents Playground

**Interactive playground for real-time AI agents built with the DotBridge research framework**

## Overview

This is the LiveKit Agents Playground component of the [DotBridge Research Framework](https://github.com/levbszabo/brdge-v1), designed for prototyping and testing real-time AI agents that utilize structured knowledge graphs extracted from multimodal content.

The playground provides a complete interface for interacting with DotBridge agents through video, audio, and chat, demonstrating the research framework's capabilities in real-time conversational AI.

## Part of DotBridge Research Framework

This playground works in conjunction with the main DotBridge system:

- **Main Repository**: [https://github.com/levbszabo/brdge-v1](https://github.com/levbszabo/brdge-v1)
- **Research Framework**: Multipass knowledge extraction and structured knowledge graph construction
- **Agent System**: Real-time AI agents powered by extracted knowledge graphs

## Architecture Integration

This playground serves as **Service #4** in the complete DotBridge system:

1. **Service 1**: React Frontend (`brdge-v1/frontend`)
2. **Service 2**: Flask Backend (`brdge-v1/backend`)
3. **Service 3**: LiveKit Agent Backend (`brdge-v1/backend/agent_realtime.py`)
4. **Service 4**: Next.js Playground (this repository) - Connects to LiveKit backend

## Docs and References

- **DotBridge Documentation**: [Main Repository README](https://github.com/levbszabo/brdge-v1)
- **LiveKit Agents Framework**: [https://docs.livekit.io/agents](https://docs.livekit.io/agents)
- **Creator Portfolio**: [https://journeymanai.io](https://journeymanai.io)

## Try the DotBridge Demo

Experience the complete DotBridge research framework at the main repository's demo, which integrates all components including this playground.

## Setting up the Playground Locally

**Prerequisites**: Ensure you have the main DotBridge repository set up first - [Setup Instructions](https://github.com/levbszabo/brdge-v1#getting-started)

1. Install dependencies

```bash
npm install
```

2. Copy and rename the `.env.example` file to `.env.local` and fill in the necessary environment variables.

```
LIVEKIT_API_KEY=<your API KEY>
LIVEKIT_API_SECRET=<Your API Secret>
NEXT_PUBLIC_LIVEKIT_URL=wss://<Your Cloud URL>
```

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

5. Ensure the DotBridge LiveKit agent is running (`python3 agent_realtime.py dev` in the main repository's backend)

6. Connect to a room and interact with your DotBridge agent

## Features

- **Real-time Agent Interaction**: Chat, voice, and video with knowledge graph-powered AI agents
- **Multimodal Communication**: Send video, audio, or text to DotBridge agents
- **Research Interface**: Configurable settings panel for testing different agent configurations
- **Knowledge Graph Integration**: Agents powered by structured knowledge extracted from content

## Research Applications

This playground demonstrates:
- **Real-time conversational AI** with structured knowledge
- **Multimodal interaction patterns** for research
- **Agent response systems** utilizing knowledge graphs
- **Production deployment** of research frameworks

## Notes

- This playground is part of the DotBridge research framework for multimodal AI
- Designed specifically for testing agents built with the DotBridge knowledge extraction pipeline
- Works best when integrated with the complete DotBridge system

## Contributing

Contributions to the DotBridge research framework are welcome! Please see the [main repository](https://github.com/levbszabo/brdge-v1) for contribution guidelines.

## License

This project is part of the DotBridge Research Framework and is licensed under the MIT License - see the [LICENSE](https://github.com/levbszabo/brdge-v1/blob/main/LICENSE) file in the main repository for details.

---

**Part of the DotBridge Research Framework** - [Main Repository](https://github.com/levbszabo/brdge-v1) | [Creator Portfolio](https://journeymanai.io)
