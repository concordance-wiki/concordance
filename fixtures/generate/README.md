# Synthetic corpus generator

A script that produces a large, deterministic, fictional corpus (thousands of notes and documents in which Concordance describes itself, built from the vocabulary of the realistic corpus) for load and performance tests: occurrence scan time, bounded neighbourhood memory, index and site weight.

Not written yet. Requirements when it is:

- deterministic from a seed; the same seed yields the same corpus byte for byte;
- no real name, place, company or product; vocabulary drawn from a fixed word list;
- parameters: number of sources, files per source, glossary size, mean file length, locale;
- output written to a temporary folder, never committed.
