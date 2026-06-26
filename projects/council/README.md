# Council

Ensemble democratico + peer review. Ver SDD seccion 3.1.

- 3 agentes en Ollama Cloud opinan en paralelo
- cada uno rankea a los otros (anonimizado)
- el chairman (GPU alquilada) sintetiza

```python
COUNCIL_MODELS = ["cloud/qwen3:32b", "cloud/deepseek-r1:32b", "cloud/llama3.3:70b"]
CHAIRMAN_MODEL = "gpu/llama3.3:70b"
```
