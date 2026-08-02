# LangGraph Revision Notes (Part 1/3)

> **JavaScript • LangGraph.js • Interview + Project Revision**
>
> **Topics Covered**
>
> - LangGraph Basics
> - Graph
> - Node
> - Edge
> - State
> - Annotation
> - Reducers
> - Execution Model
> - Sequential Workflow
> - Parallel Workflow
> - Conditional Workflow
> - Iterative Workflow

---

# Installation

```bash
npm install @langchain/langgraph
npm install @langchain/core
npm install @langchain/google-genai
npm install dotenv
```

---

# Common Imports

```javascript
import {
  StateGraph,
  START,
  END,
  Annotation,
  Send,
  Command,
  interrupt,
  MemorySaver
} from "@langchain/langgraph";

import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  RemoveMessage
} from "@langchain/core/messages";

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
```

---

# What is LangGraph?

State-based workflow framework for building AI Agents.

Instead of

```text
LLM → LLM → LLM
```

You create

```mermaid
graph LR
START --> Planner
Planner --> Search
Search --> END
```

---

## Why LangGraph?

| LangChain | LangGraph |
|------------|-----------|
| Linear Chains | Graph Workflows |
| Limited Routing | Dynamic Routing |
| No Loops | Native Loops |
| Basic Agents | Production AI Agents |
| Limited Memory | Persistence |
| No HITL | HITL Support |

---

# Core Components

| Component | Purpose |
|------------|----------|
| Graph | Entire workflow |
| Node | Function |
| Edge | Connection |
| State | Shared Memory |
| Reducer | Merge Updates |
| START | Entry |
| END | Exit |

---

# Graph

Entire workflow.

```javascript
const builder = new StateGraph(State);
```

---

# Node

A node is simply a function.

```javascript
async function chatNode(state){

    return {

        messages:[response]

    };

}
```

Register

```javascript
builder.addNode(
    "chat",
    chatNode
);
```

---

# Edge

Connect nodes.

```javascript
builder.addEdge(
    START,
    "chat"
);

builder.addEdge(
    "chat",
    END
);
```

---

# State

Shared memory between nodes.

```javascript
const AppState = Annotation.Root({

    messages: Annotation(),

    summary: Annotation(),

    results: Annotation({
        reducer:(state,update)=>[
            ...state,
            ...update
        ],
        default:()=>[]
    })

});
```

---

## State Flow

```mermaid
graph LR

State --> Node

Node --> Update

Update --> Reducer

Reducer --> NewState
```

---

# Annotation

Creates state fields.

```javascript
Annotation()
```

With reducer

```javascript
Annotation({

reducer:(state,update)=>[
...state,
...update
],

default:()=>[]

})
```

---

# Reducers

Merge state updates.

Without reducer

```
Old State

↓

New State

↓

Old Data Lost
```

With reducer

```
Old State

+

Update

↓

Merged State
```

Example

```javascript
results: Annotation({

    reducer:(state,update)=>[
        ...state,
        ...update
    ],

    default:()=>[]

})
```

Formula

$$
State_{new}
=
Reducer(State_{old},Update)
$$

---

# Compile

Compile graph.

```javascript
const graph = builder.compile();
```

With persistence

```javascript
const graph = builder.compile({

    checkpointer

});
```

---

# invoke()

Run graph once.

```javascript
await graph.invoke(state);
```

---

# stream()

Stream execution.

```javascript
for await(

const event

of graph.stream(state)

){

console.log(event);

}
```

---

# Execution Model

```mermaid
graph LR

START --> Node1

Node1 --> Node2

Node2 --> END
```

Runtime

```
Load State

↓

Execute Node

↓

Partial Update

↓

Reducer

↓

New State

↓

Next Node
```

Formula

$$
State_t
\rightarrow
Node
\rightarrow
Reducer
\rightarrow
State_{t+1}
$$

---

# Sequential Workflow

One node executes after another.

Architecture

```mermaid
graph LR

START --> A

A --> B

B --> END
```

Code

```javascript
builder.addEdge(
START,
"A"
);

builder.addEdge(
"A",
"B"
);

builder.addEdge(
"B",
END
);
```

Formula

$$
A
\rightarrow
B
\rightarrow
C
$$

### Use Cases

- OCR
- Translation
- Summarization
- AI Pipeline

---

# Parallel Workflow

Multiple nodes execute simultaneously.

Architecture

```mermaid
graph LR

START --> Planner

Planner --> Worker1

Planner --> Worker2

Planner --> Worker3

Worker1 --> END

Worker2 --> END

Worker3 --> END
```

Needs Reducers.

```javascript
results: Annotation({

reducer:(state,update)=>[
...state,
...update
]

})
```

Formula

$$
Worker_1
\parallel
Worker_2
\parallel
Worker_3
$$

### Use Cases

- Multi Search
- Multi API
- Multi Tool
- Research Agent
- Travel Planner

---

# Conditional Workflow

Choose ONE path.

Architecture

```mermaid
graph LR

START --> Router

Router --> Chat

Router --> Search
```

Router

```javascript
function route(state){

    if(state.search){

        return "search";

    }

    return "chat";

}
```

Register

```javascript
builder.addConditionalEdges(

"router",

route

);
```

Formula

$$
Route(State)
\rightarrow
NextNode
$$

---

# Iterative Workflow

Loop until condition satisfied.

Architecture

```mermaid
graph LR

Generator --> Evaluator

Evaluator --> Generator

Evaluator --> END
```

Pattern

```
Generate

↓

Evaluate

↓

Improve

↓

Repeat
```

Formula

$$
Generator
\rightarrow
Evaluator
\rightarrow
Optimizer
\rightarrow
Generator
$$

### Use Cases

- Reflection
- Retry
- Self Improvement
- AI Evaluation

---

# Minimal Graph Template

```javascript
const builder = new StateGraph(AppState);

builder.addNode(
"chat",
chatNode
);

builder.addEdge(
START,
"chat"
);

builder.addEdge(
"chat",
END
);

const graph = builder.compile();

await graph.invoke(initialState);
```

---

# invoke() vs stream()

| invoke() | stream() |
|------------|-----------|
| One Response | Streaming Response |
| Easier | Better UX |
| Simple APIs | Chat Applications |

---

# Sequential vs Parallel

| Sequential | Parallel |
|------------|-----------|
| One after another | Simultaneously |
| Simple | Faster |
| No Reducer | Reducer Required |

---

# Best Practices

- Design State first
- Keep Nodes Small
- One Responsibility per Node
- Use Reducers for Arrays
- Use Parallel for Independent Tasks
- Use Conditional Routing instead of nested if/else
- Keep Router Lightweight
- Return Partial State only

---

# Common Mistakes

❌ Giant Nodes

❌ Forgetting Reducers

❌ Overwriting Arrays

❌ Business Logic inside Router

❌ Hardcoded Workflows

❌ Returning Entire State

---

# Interview Notes

### Why LangGraph?

Supports

- Loops
- Routing
- Persistence
- HITL
- Multi-Agent
- Parallel Execution

---

### Node vs State

Node

→ Performs Work

State

→ Stores Data

---

### Why Reducers?

Merge updates from multiple nodes.

---

### Graph Execution

```
Load State

↓

Execute Node

↓

Reducer

↓

Next Node
```

---

### Parallel Execution

Reducers are mandatory.

---

# Quick Revision

## Important Imports

```javascript
import {
StateGraph,
START,
END,
Annotation,
Send,
Command,
interrupt,
MemorySaver
} from "@langchain/langgraph";
```

---

## Important APIs

```javascript
StateGraph()

Annotation.Root()

builder.addNode()

builder.addEdge()

builder.addConditionalEdges()

compile()

invoke()

stream()
```

---

## Architecture

```text
Graph

↓

Node

↓

State

↓

Reducer

↓

Next Node
```

---

## Formulas

Reducer

$$
State_{new}
=
Reducer(State_{old},Update)
$$

Sequential

$$
A
\rightarrow
B
\rightarrow
C
$$

Parallel

$$
A
\parallel
B
\parallel
C
$$

Conditional

$$
Route(State)
\rightarrow
NextNode
$$

Iterative

$$
Generator
\rightarrow
Evaluator
\rightarrow
Generator
$$

---

## Remember

- Graph = Workflow
- Node = Function
- State = Shared Memory
- Reducer = Merge Updates
- Edge = Connection
- Sequential = One by One
- Parallel = Together
- Conditional = Choose Path
- Iterative = Loop
- `compile()` = Build Graph
- `invoke()` = Execute Graph
- `stream()` = Stream Execution


---

# LangGraph Revision Notes (Part 2/3)

> **JavaScript • LangGraph.js • Advanced Revision**
>
> **Topics Covered**
>
> - Persistence
> - Checkpointers
> - MemorySaver
> - PostgreSQL Checkpointer
> - Thread ID
> - State History
> - Time Travel
> - Tools
> - ToolNode
> - MCP
> - Human In The Loop
> - Command
> - interrupt()
> - SubGraphs

---

# Persistence

## What?

Persistence allows LangGraph to **save and restore graph state**.

Without Persistence

```
Invoke

↓

Run

↓

END

↓

State Lost
```

With Persistence

```
Invoke

↓

Load State

↓

Run

↓

Save State
```

---

## Why?

- Short-Term Memory
- Resume Execution
- Fault Tolerance
- Human Approval
- Time Travel

---

# Checkpointer

Stores graph checkpoints.

```javascript
const graph = builder.compile({

    checkpointer

});
```

LangGraph automatically

```
Load State

↓

Execute

↓

Save State
```

---

# MemorySaver

In-memory checkpointer.

Import

```javascript
import {

MemorySaver

} from "@langchain/langgraph";
```

Usage

```javascript
const checkpointer =
new MemorySaver();

const graph =
builder.compile({

checkpointer

});
```

Characteristics

| Feature | MemorySaver |
|----------|-------------|
| Storage | RAM |
| Restart Safe | ❌ |
| Development | ✅ |
| Production | ❌ |

---

# Thread ID

Conversation Identifier.

```javascript
const config={

configurable:{

thread_id:"user-1"

}

};
```

Invoke

```javascript
await graph.invoke(

state,

config

);
```

Different thread

↓

Different memory.

```
user-1

↓

Conversation A

----------------

user-2

↓

Conversation B
```

---

# State History

Retrieve previous checkpoints.

```javascript
await graph.getState(config);
```

History

```javascript
await graph.getStateHistory(config);
```

Useful For

- Debugging
- Auditing
- Time Travel

---

# Fault Tolerance

Graph crashes?

```
Checkpoint

↓

Restart

↓

Resume
```

Instead of

```
Restart From Beginning
```

---

# Time Travel

Restore previous checkpoint.

```
Checkpoint 1

↓

Checkpoint 2

↓

Checkpoint 3

↓

Go Back

↓

Checkpoint 2
```

Useful

- Debugging
- Human Corrections
- Replay

---

# PostgreSQL Checkpointer

Production persistence.

Install

```bash
npm install @langchain/langgraph-checkpoint-postgres
npm install pg
```

Import

```javascript
import {

PostgresSaver

}

from "@langchain/langgraph-checkpoint-postgres";
```

Connect

```javascript
const checkpointer =

new PostgresSaver({

connectionString:

process.env.DATABASE_URL

});
```

Compile

```javascript
const graph =
builder.compile({

checkpointer

});
```

---

# Docker PostgreSQL

```bash
docker run --name postgres \

-e POSTGRES_PASSWORD=postgres \

-e POSTGRES_DB=langgraph \

-p 5432:5432 \

-d postgres
```

Connection

```env
DATABASE_URL=

postgresql://postgres:postgres@localhost:5432/langgraph
```

---

# MemorySaver vs PostgreSQL

| MemorySaver | PostgreSQL |
|--------------|------------|
| RAM | Database |
| Development | Production |
| Lost on Restart | Persistent |
| Fast | Durable |

---

# Tools

## What?

Functions callable by the LLM.

Example

```javascript
import {

tool

}

from "@langchain/core/tools";
```

---

Tool

```javascript
const weatherTool = tool(

async({city})=>{

return `Weather of ${city}`;

},

{

name:"weather"

}

);
```

---

Bind

```javascript
const llm =

model.bindTools([

weatherTool

]);
```

---

# ToolNode

Executes tool calls.

Import

```javascript
import {

ToolNode

}

from "@langchain/langgraph/prebuilt";
```

Usage

```javascript
const toolNode =

new ToolNode([

weatherTool

]);
```

---

Flow

```mermaid
graph LR

LLM --> ToolNode

ToolNode --> Tool

Tool --> LLM
```

---

# MCP

Model Context Protocol

Purpose

Connect LLM

↓

External Systems

Examples

- Filesystem
- GitHub
- PostgreSQL
- Slack
- Browser

---

Architecture

```mermaid
graph LR

LLM --> MCP Client

MCP Client --> MCP Server

MCP Server --> Filesystem
```

---

Common Imports

```javascript
import {

MultiServerMCPClient

}

from "@langchain/mcp-adapters";
```

---

Example

```javascript
const client =

new MultiServerMCPClient({

servers:{

filesystem:{

command:"npx",

args:["-y",

"@modelcontextprotocol/server-filesystem",

"./"]

}

}

});
```

---

# Human In The Loop (HITL)

Pause graph for approval.

---

interrupt()

```javascript
interrupt({

question:"Approve?"

});
```

Graph

```
Run

↓

Pause

↓

Human

↓

Resume
```

---

Resume

```javascript
graph.invoke(

new Command({

resume:true

})

);
```

---

# Command

Control runtime.

Goto

```javascript
return new Command({

goto:"approval"

});
```

Resume

```javascript
return new Command({

resume:data

});
```

---

Command Use Cases

- Routing
- Resume
- Manual Override

---

# HITL Flow

```mermaid
graph LR

START --> Agent

Agent --> interrupt

interrupt --> Human

Human --> Resume

Resume --> END
```

---

# SubGraphs

Reusable graphs.

Think

```
Functions

↓

SubGraphs
```

---

Approach 1

Shared State

```javascript
builder.addNode(

"planner",

subGraph

);
```

Parent & Child

↓

Same State

---

Approach 2

Different State

```javascript
await subGraph.invoke(

{

input:data

}

);
```

Child

↓

Own State

↓

Return Result

---

# Shared vs Different State

| Shared | Different |
|----------|-----------|
| Same State | Own State |
| Easy | Flexible |
| Tightly Coupled | Independent |

---

# Persistence Modes

## Default

```javascript
compile()
```

Memory

↓

Current Invocation Only

---

## Per Thread

```javascript
compile({

checkpointer:true

})
```

Uses Parent Checkpointer.

Keeps

Thread Memory.

---

## Stateless

```javascript
compile({

checkpointer:false

})
```

No Memory

No Checkpoints

No Resume

---

# Parent vs SubGraph

Parent

```javascript
const graph=

builder.compile({

checkpointer

});
```

SubGraph

```javascript
compile()

compile({

checkpointer:true

})

compile({

checkpointer:false

})
```

Remember

Parent owns

```
MemorySaver

or

PostgreSQL
```

SubGraph decides

```
Use It?

or

Ignore It?
```

---

# Production Folder Structure

```
project/

graph/

nodes/

memory/

tools/

prompts/

utils/

index.js
```

---

# Best Practices

- PostgreSQL in Production
- MemorySaver only for Development
- One Thread per User
- Small SubGraphs
- Reusable Nodes
- HITL for Critical Actions
- Use Tools instead of Prompting APIs
- Keep Checkpointer in Parent Graph

---

# Common Mistakes

❌ Using MemorySaver in Production

❌ Same thread_id for all users

❌ Giant SubGraphs

❌ Not saving checkpoints

❌ Calling APIs directly instead of Tools

❌ Using `checkpointer:true` thinking it creates a database

---

# Interview Notes

### Why Persistence?

Resume execution.

---

### MemorySaver vs PostgreSQL?

Development vs Production.

---

### Thread ID?

Conversation Identifier.

---

### interrupt()?

Pause graph.

---

### Command?

Runtime control.

---

### SubGraph?

Reusable graph.

---

### checkpointer:true?

Uses parent's checkpointer.

Does NOT create one.

---

# Quick Revision

## Imports

```javascript
import {

MemorySaver,

Command,

interrupt

}

from "@langchain/langgraph";

import {

ToolNode

}

from "@langchain/langgraph/prebuilt";

import {

tool

}

from "@langchain/core/tools";

import {

PostgresSaver

}

from "@langchain/langgraph-checkpoint-postgres";
```

---

## Important APIs

```javascript
compile({

checkpointer

})

graph.invoke()

graph.getState()

graph.getStateHistory()

interrupt()

Command()

ToolNode()

tool()

bindTools()
```

---

## Architecture

Persistence

```text
Load

↓

Run

↓

Save
```

Tools

```text
LLM

↓

ToolNode

↓

Tool
```

MCP

```text
LLM

↓

MCP Client

↓

MCP Server

↓

External Resource
```

HITL

```text
Run

↓

Pause

↓

Human

↓

Resume
```

SubGraph

```text
Parent

↓

SubGraph

↓

Return
```

---

## Formulas

Checkpoint

$$
State_t
\rightarrow
Checkpoint
\rightarrow
State_{t+1}
$$

Persistence

$$
Load
\rightarrow
Execute
\rightarrow
Save
$$

HITL

$$
Execute
\rightarrow
Interrupt
\rightarrow
Resume
$$

SubGraph

$$
Parent
\rightarrow
SubGraph
\rightarrow
Parent
$$

---

# LangGraph Revision Notes (Part 3/3)

> **JavaScript • LangGraph.js • Production Memory + Fan-Out/Fan-In + Cheat Sheet**

**Topics Covered**

- LLM Memory
- Short-Term Memory
- Long-Term Memory
- Custom State
- MessagesState vs Custom State
- Context Window
- Trimming
- Token Budget
- Summarization
- RemoveMessage
- Fan-Out
- Fan-In
- Send
- Production Architecture
- Folder Structure
- Best Practices
- API Cheat Sheet
- Comparison Tables

---

# LLM Memory

## LLMs are Stateless

Every API call is independent.

```
Request

↓

LLM

↓

Response

↓

Forget
```

LLM never remembers previous conversations.

---

# Memory Architecture

```
User

↓

Application

↓

Database

↓

LLM
```

Memory belongs to the **Application**, not the LLM.

---

# Short-Term Memory

Remembers the current conversation.

Uses

- Thread ID
- Checkpointer
- Conversation History

Architecture

```mermaid
graph LR

User --> Checkpointer

Checkpointer --> Messages

Messages --> LLM
```

---

# Long-Term Memory

Remembers information across conversations.

Examples

- User Profile
- Preferences
- Past Projects
- Knowledge Base

Usually implemented using

- Vector Database
- PostgreSQL
- MongoDB

---

# Short-Term vs Long-Term

| Short-Term | Long-Term |
|------------|------------|
| Current Conversation | Across Conversations |
| Thread Memory | User Knowledge |
| MemorySaver | Vector DB / SQL |

---

# Custom State

Preferred for production.

```javascript
const ChatState = Annotation.Root({

messages: Annotation({

reducer:(state,update)=>[
...state,
...update
],

default:()=>[]

}),

summary: Annotation({

default:()=>''

})

});
```

---

# MessagesState vs Custom State

| MessagesState | Custom State |
|---------------|--------------|
| Chat Only | Fully Flexible |
| Fixed Structure | Add Any Field |
| Simple Bots | Production Agents |

---

# Chat Node

```javascript
async function chatNode(state){

const response =
await model.invoke(

state.messages

);

return{

messages:[response]

};

}
```

---

# MemorySaver

```javascript
const checkpointer =
new MemorySaver();

const graph =
builder.compile({

checkpointer

});
```

Invoke

```javascript
await graph.invoke(

{

messages:[

new HumanMessage("Hello")

]

},

{

configurable:{

thread_id:"user-1"

}

}

);
```

---

# Context Window

Every LLM has limits.

```
Prompt

↓

Token Count

↓

Context Window
```

Example

```
128K Tokens
```

---

# Prompt Structure

```
System Prompt

+

Summary

+

Recent Messages

+

Current Question
```

Formula

$$
Prompt
=
Summary
+
RecentMessages
+
Question
$$

---

# Trimming

Purpose

Keep prompt small.

Simple

```javascript
const recentMessages =

state.messages.slice(-20);
```

Production

```javascript
import {

trimMessages

}

from "@langchain/core/messages";
```

```javascript
const trimmed =
await trimMessages({

messages:state.messages,

tokenCounter:model,

maxTokens:4000,

strategy:"last"

});
```

---

# Message Count vs Token Count

| Message Count | Token Count |
|---------------|-------------|
| Inaccurate | Accurate |
| Simple | Production |

Always prefer

```
Token Budget
```

---

# Token Budget

Instead of

```javascript
messages.length > 40
```

Use

```javascript
tokenCount > 8000
```

Example

```javascript
const TOKEN_BUDGET={

maxPromptTokens:8000,

responseReserve:1000,

summarizeThreshold:7000

};
```

---

# Summarization

Purpose

Compress old conversations.

Before

```
300 Messages
```

After

```
Summary

+

Last 20 Messages
```

Architecture

```mermaid
graph LR

Messages --> Summarizer

Summarizer --> Summary

Summary --> Chat
```

---

# Summary State

```javascript
summary: Annotation({

default:()=>''

})
```

Used inside

```javascript
new SystemMessage(

state.summary

);
```

---

# RemoveMessage

Delete old messages.

Import

```javascript
import {

RemoveMessage

}

from "@langchain/core/messages";
```

Example

```javascript
const deletes =

oldMessages.map(

message=>

new RemoveMessage({

id:message.id

})

);
```

Return

```javascript
return{

summary:newSummary,

messages:deletes

};
```

---

# Memory Lifecycle

```mermaid
graph LR

Load --> Trim

Trim --> Summarize

Summarize --> Delete

Delete --> Chat

Chat --> Save
```

---

# Why Summarize?

Instead of

```
500 Messages
```

Store

```
Summary

+

20 Messages
```

Smaller Prompt

↓

Lower Cost

↓

Faster

---

# Fan-Out

Planner creates dynamic workers.

Import

```javascript
import {

Send

}

from "@langchain/langgraph";
```

Planner

```javascript
return state.tasks.map(

task=>

new Send(

"worker",

{

currentTask:task

}

)

);
```

---

# Send

Meaning

```
Run this node

with this state
```

Contains

```
Destination

+

Payload
```

Think

```javascript
worker.invoke(payload)
```

---

# Fan-Out Runtime

```mermaid
graph LR

Planner --> Worker1

Planner --> Worker2

Planner --> Worker3
```

Formula

$$
Planner
\rightarrow
\sum_{i=1}^{N}
Worker_i
$$

---

# Worker

```javascript
async function worker(state){

return{

results:[

{

task:state.currentTask

}

]

};

}
```

---

# Fan-In

Reducer merges workers.

Reducer

```javascript
results: Annotation({

reducer:(state,update)=>[

...state,

...update

]

})
```

Formula

$$
Results
=
\bigcup_{i=1}^{N}
Worker_i
$$

---

# Fan-Out vs Conditional

| Conditional | Fan-Out |
|--------------|---------|
| One Path | Many Paths |
| String | Send[] |
| Router | Planner |

---

# Travel Planner Pattern

```
Planner

↓

Flights

Hotels

Weather

Budget

↓

Reducers

↓

Itinerary
```

---

# Production Folder Structure

```
project/

graph/
    graph.js
    state.js

nodes/
    planner.js
    worker.js

memory/
    checkpointer.js

tools/

prompts/

utils/

index.js
```

---

# Production Best Practices

## State

- Small
- Serializable
- Modular

---

## Nodes

- One Responsibility
- Stateless
- Reusable

---

## Memory

- PostgreSQL
- Token Budget
- Summaries
- Trim Prompt
- Delete Old Messages

---

## Fan-Out

- Independent Tasks
- Reducers Required
- Avoid Shared Mutable Data

---

## Routing

- Keep Router Lightweight
- No Business Logic

---

## Persistence

- Parent owns Checkpointer
- One Thread per User

---

# Common Mistakes

❌ No Reducer

❌ MemorySaver in Production

❌ Same thread_id for all users

❌ Trimming State instead of Prompt

❌ Message Count instead of Token Count

❌ Huge Nodes

❌ Forgetting RemoveMessage

❌ Returning Entire State

---

# Important Imports Cheat Sheet

```javascript
import {

StateGraph,
START,
END,
Annotation,
MemorySaver,
Send,
Command,
interrupt

} from "@langchain/langgraph";

import {

ToolNode

} from "@langchain/langgraph/prebuilt";

import {

tool

} from "@langchain/core/tools";

import {

HumanMessage,
AIMessage,
SystemMessage,
RemoveMessage

} from "@langchain/core/messages";

import {

ChatGoogleGenerativeAI

} from "@langchain/google-genai";

import {

PostgresSaver

} from "@langchain/langgraph-checkpoint-postgres";
```

---

# Important APIs

```javascript
StateGraph()

Annotation.Root()

builder.addNode()

builder.addEdge()

builder.addConditionalEdges()

compile()

invoke()

stream()

interrupt()

Command()

Send()

ToolNode()

tool()

bindTools()

graph.getState()

graph.getStateHistory()

trimMessages()
```

---

# Comparison Tables

## LangChain vs LangGraph

| LangChain | LangGraph |
|------------|-----------|
| Chains | Graphs |
| Simple | Production |
| Linear | Flexible |

---

## Sequential vs Parallel

| Sequential | Parallel |
|------------|-----------|
| One by One | Simultaneous |

---

## Conditional vs Fan-Out

| Conditional | Fan-Out |
|--------------|---------|
| String | Send[] |
| One Path | Multiple Workers |

---

## Tool vs MCP

| Tool | MCP |
|------|-----|
| Local Function | External System |
| Simple | Enterprise |

---

## MemorySaver vs PostgreSQL

| MemorySaver | PostgreSQL |
|--------------|------------|
| RAM | Database |
| Development | Production |

---

## MessagesState vs Custom State

| MessagesState | Custom |
|---------------|--------|
| Chat Only | Any Data |

---

## Short-Term vs Long-Term

| Short | Long |
|--------|------|
| Thread | User Profile |

---

## Shared vs Different SubGraph

| Shared | Different |
|----------|-----------|
| Same State | Own State |

---

## Per Invocation vs Per Thread vs Stateless

| Mode | Memory |
|------|---------|
| Default | Invocation |
| checkpointer:true | Thread |
| checkpointer:false | None |

---

# LangGraph Flow

```mermaid
graph LR

START --> Planner

Planner --> Worker

Worker --> Reducer

Reducer --> END
```

---

# Complete Runtime

```text
Load State

↓

Route

↓

Execute Node

↓

Reducers

↓

Persistence

↓

Next Node

↓

END
```

---

# Ultimate Quick Revision

## Workflow Types

```
Sequential

A → B
```

```
Parallel

A || B || C
```

```
Conditional

A

or

B
```

```
Iterative

Generate

↓

Evaluate

↓

Repeat
```

```
Fan-Out

Planner

↓

N Workers
```

---

## Memory Flow

```
Load

↓

Trim

↓

Summarize

↓

Delete

↓

LLM

↓

Save
```

---

## Remember

- Graph = Workflow
- Node = Function
- State = Shared Data
- Reducer = Merge
- Send = Fan-Out
- Command = Runtime Control
- interrupt = Pause
- Thread = Conversation
- Checkpointer = Persistence
- Tool = Function
- MCP = External System
- Summary = Compress Memory
- RemoveMessage = Delete History
- Fan-In = Reducer
- Token Budget > Message Count
- Custom State > MessagesState (Production)
- PostgreSQL > MemorySaver (Production)
- Parent owns Checkpointer
- SubGraph chooses how to use it