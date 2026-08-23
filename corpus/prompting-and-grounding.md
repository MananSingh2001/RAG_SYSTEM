# Prompting and Grounding

Grounding is the discipline of making a language model answer only from supplied
sources rather than from its parametric memory. It is what separates a retrieval
system that can be trusted from a chatbot that sounds confident and is sometimes
wrong.

## The grounded system prompt

A grounded prompt gives the model numbered sources and three firm instructions:
use only those sources, cite the source numbers used inline, and say plainly
when the sources do not contain the answer. Numbering the sources lets the model
attach a citation like [1] or [2][3] to each claim, which a user can verify.

## Temperature

Generation temperature controls randomness. For grounded answering it is kept
low, around 0.2, so the model stays close to the supplied text instead of
improvising. High temperature is appropriate for creative writing, not for a
system whose job is to reproduce facts faithfully.

## Context assembly

Retrieved passages are assembled into a numbered context block that precedes the
question. The order can matter: some models attend more strongly to the start
and end of a long context, an effect sometimes called "lost in the middle," so
placing the most relevant passage first is a reasonable default. The assembled
context must respect a budget so it never exceeds the model's window.

## Honest refusal

A grounded system must be willing to refuse. When retrieval returns nothing
above the similarity threshold, the correct behavior is to state that the corpus
has no coverage for the question, not to answer from general knowledge. Treating
refusal as a valid, successful outcome, rather than a failure, is what keeps the
system honest and its citations meaningful.

## Citations as a contract

Inline citations are a contract with the reader: every claim can be traced to a
passage. This makes errors auditable, because a wrong answer will cite a passage
that does not actually support it, which is easy to catch in review and in
automated evaluation.
