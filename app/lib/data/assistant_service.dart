/// Backs the mascot chat. Replace [reply] with a call to your backend
/// (Supabase Edge Function, Python service, LLM API...).
class AssistantService {
  Future<String> reply(String message) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    return 'Todavía estoy aprendiendo. Pronto podré ayudarte con eso.';
  }
}
