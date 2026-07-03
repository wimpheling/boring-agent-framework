# Own the Loop

This is example code. It is not BAF behavior. Copy it, modify it, delete it.
The loop is yours.

The example shows the intended shape:

1. append user input to a session;
2. call your model with `toModelMessages(session)`;
3. append assistant output;
4. append tool calls and tool results in your own code;
5. repeat until your loop decides to stop.
