// SkyTasks AI client. Drop into lib/ of the Flutter app.
// Talks only to our Supabase Edge Function `ai-assist`; no AI key in the app.
// Every result is a suggestion: show it, let the user edit/confirm, then save.

import 'package:supabase_flutter/supabase_flutter.dart';

enum AiFailure {
  /// User used today's AI quota. Show: "העוזר החכם נח, נתראה מחר".
  limit,

  /// AI is off or every free provider is busy. Same friendly message.
  unavailable,

  /// Not signed in.
  auth,

  /// Text empty / too long.
  badInput,
}

class AiTask {
  final String title;
  final DateTime? date;
  final String? time; // HH:MM
  final String priority; // low | normal | high
  AiTask(this.title, this.date, this.time, this.priority);
}

class AiStep {
  final String title;
  final int minutes;
  AiStep(this.title, this.minutes);
}

class AiResult<T> {
  final T? value;
  final AiFailure? failure;
  final int? remaining; // AI uses left today
  const AiResult.ok(this.value, this.remaining) : failure = null;
  const AiResult.fail(this.failure, [this.remaining]) : value = null;
  bool get ok => failure == null;
}

class AiAssist {
  AiAssist([SupabaseClient? client]) : _client = client ?? Supabase.instance.client;
  final SupabaseClient _client;

  /// "Empty your head": free text -> list of tasks.
  Future<AiResult<List<AiTask>>> brainDump(String text) async {
    final r = await _call({'mode': 'dump', 'text': text});
    if (r.failure != null) return AiResult.fail(r.failure, r.remaining);
    final tasks = (r.value!['tasks'] as List).map((t) {
      final d = t['date'] as String?;
      return AiTask(t['title'], d == null ? null : DateTime.parse(d), t['time'], t['priority']);
    }).toList();
    return AiResult.ok(tasks, r.remaining);
  }

  /// "Break it down": one scary task -> 3-7 small steps.
  Future<AiResult<List<AiStep>>> breakDown(String taskTitle) async {
    final r = await _call({'mode': 'breakdown', 'text': taskTitle});
    if (r.failure != null) return AiResult.fail(r.failure, r.remaining);
    final steps = (r.value!['steps'] as List)
        .map((s) => AiStep(s['title'], (s['minutes'] as num).toInt()))
        .toList();
    return AiResult.ok(steps, r.remaining);
  }

  /// "Postpone without guilt": kind sentence + a 2-minute first step.
  Future<AiResult<({String message, String firstStep})>> unstick(String taskTitle, int postponed) async {
    final r = await _call({'mode': 'stuck', 'text': taskTitle, 'postponed': postponed});
    if (r.failure != null) return AiResult.fail(r.failure, r.remaining);
    return AiResult.ok((message: r.value!['message'] as String, firstStep: r.value!['first_step'] as String), r.remaining);
  }

  Future<AiResult<Map<String, dynamic>>> _call(Map<String, dynamic> body) async {
    final now = DateTime.now();
    body['today'] = '${now.year.toString().padLeft(4, '0')}-'
        '${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    body['lang'] ??= 'he';
    try {
      final res = await _client.functions.invoke('ai-assist', body: body);
      final data = Map<String, dynamic>.from(res.data as Map);
      return AiResult.ok(data, data['remaining'] as int?);
    } on FunctionException catch (e) {
      return AiResult.fail(switch (e.status) {
        429 => AiFailure.limit,
        401 => AiFailure.auth,
        400 => AiFailure.badInput,
        _ => AiFailure.unavailable,
      }, 0);
    } catch (_) {
      return const AiResult.fail(AiFailure.unavailable);
    }
  }
}
