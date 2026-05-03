
Action: file_editor view /app/backend/server.py
Observation: [Showing lines 160-245 of 451 total] /app/backend/server.py:
160|    }
161|
162|
163|async def classify_note(text: str, allow_split: bool = True) -> list[dict]:
164|    """
165|    Use GPT-5.2 to:
166|    - Detect if the input contains MULTIPLE distinct notes (different topics/tasks).
167|    - For each detected note, return: content, title, summary, categories, urgency, reminder date, amount.
168|    Returns a list of items (1 or more).
169|    """
170|    if not EMERGENT_LLM_KEY or not text.strip():
171|        return [_fallback_item(text)]
172|
173|    today = datetime.now(timezone.utc).date().isoformat()
174|    split_instruction = (
175|        "L'utilisateur peut écrire PLUSIEURS notes/tâches/idées en vrac dans le même bloc. "
176|        "Tu dois IDENTIFIER chaque idée distincte et la séparer en éléments. "
177|        "Une idée distincte = un sujet différent, une tâche différente, ou une catégorie clairement différente. "
178|        "Si tout le texte parle du MÊME sujet/tâche, retourne UN SEUL élément. "
179|        "Ne découpe PAS artificiellement: regroupe les phrases qui parlent du même sujet. "
180|    ) if allow_split else (
181|        "Considère TOUT le texte comme UNE SEULE note. Retourne un seul élément. "
182|    )
183|
184|    system = (
185|        "Tu es une IA qui organise des notes en français. "
186|        f"Aujourd'hui = {today}. "
187|        f"{split_instruction}"
188|        f"Catégories possibles: {', '.join(CATEGORIES)}. "
189|        "Réponds UNIQUEMENT avec un JSON strict (pas de markdown). "
190|        "Format: {\"items\": [ ... ]} où chaque item a: "
191|        "content (string: le texte original concernant cette note, en gardant les phrases d'origine), "
192|        "title (string court 3-8 mots), "
193|        "summary (string 1 phrase courte), "
194|        "categories (array de 1 à 3 catégories de la liste), "
195|        "urgent (bool, true si mots: amende, avocat, tribunal, urgent, demain, échéance, impôts, retard, paiement immédiat, OU délai très court), "
196|        "reminder_date (string ISO YYYY-MM-DD ou null. Détecte: 'demain', 'lundi prochain', 'dans 3 jours', 'vendredi', 'avant jeudi', dates explicites), "
197|        "amount (number en euros ou null)."
198|    )
199|
200|    chat = LlmChat(
201|        api_key=EMERGENT_LLM_KEY,
202|        session_id=f"classify-{uuid.uuid4()}",
203|        system_message=system,
204|    ).with_model("openai", "gpt-5.2")
205|
206|    try:
207|        response = await chat.send_message(UserMessage(text=text))
208|        raw = str(response).strip()
209|        raw = re.sub(r"^```(?:json)?", "", raw).strip()
210|        raw = re.sub(r"```$", "", raw).strip()
211|        data = json.loads(raw)
212|
213|        items_raw = data.get("items") or []
214|        if not isinstance(items_raw, list) or not items_raw:
215|            return [_fallback_item(text)]
216|
217|        results: list[dict] = []
218|        for item in items_raw:
219|            if not isinstance(item, dict):
220|                continue
221|            content = str(item.get("content") or "").strip() or text
222|            cats = [c for c in (item.get("categories") or []) if c in CATEGORIES]
223|            if not cats:
224|                cats = ["Personnel"]
225|            urgent_flag = bool(item.get("urgent", False)) or _heuristic_urgent(content)
226|            results.append({
227|                "content": content,
228|                "title": str(item.get("title") or content[:60] or "Note").strip(),
229|                "summary": str(item.get("summary") or content[:200]).strip(),
230|                "categories": cats,
231|                "urgent": urgent_flag,
232|                "reminder_date": item.get("reminder_date"),
233|                "amount": item.get("amount"),
234|            })
235|
236|        return results or [_fallback_item(text)]
237|    except Exception as e:
238|        logger.exception("Classification failed: %s", e)
239|        return [_fallback_item(text)]
240|
241|
242|# ----- Routes -----
243|@api_router.get("/")
244|async def root():
245|    return {"message": "Smart Notes IA API", "version": "1.0"}
 [86 lines shown. Remaining: lines 246-451 (206 lines). Use view_range parameter to continue.]
