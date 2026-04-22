// ...existing code...
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../widgets/app_scaffold.dart';
import '../repositories/auth_repository.dart';

class AutoAdjustSettingsScreen extends ConsumerStatefulWidget {
  final String shopId;
  const AutoAdjustSettingsScreen({super.key, required this.shopId});

  @override
  ConsumerState<AutoAdjustSettingsScreen> createState() => _AutoAdjustSettingsScreenState();
}

class _AutoAdjustSettingsScreenState extends ConsumerState<AutoAdjustSettingsScreen> {
  bool loading = true;
  bool saving = false;
  bool simulating = false;
  String? error;

  // 目標達成率（パーセンテージ）
  int overallTargetPercent = 70;

  // config
  Map<String, int> priorities = {}; // userId -> priority
  Map<int, int> capacities = { for (var h=0; h<24; h++) h: 0 }; // hour -> capacity

  // simulation result
  Map<String, dynamic>? simResult;
  DateTime targetDate = DateTime.now();

  final _formKey = GlobalKey<FormState>();

  // 自前の日付フォーマッタ
  String _formatDate(DateTime d) {
    final y = d.year.toString().padLeft(4, '0');
    final m = d.month.toString().padLeft(2, '0');
    final dd = d.day.toString().padLeft(2, '0');
    return '$y-$m-$dd';
  }

  @override
  void initState() {
    super.initState();
    _loadConfig();
  }

  Future<void> _loadConfig() async {
    setState(() { loading = true; error = null; });
    try {
      final auth = ref.read(authProvider.notifier);
      final resp = await auth.fetchAutoAdjustConfig(widget.shopId);
      final p = Map<String, dynamic>.from(resp['priorities'] ?? {});
      final c = Map<String, dynamic>.from(resp['capacities'] ?? {});
      setState(() {
        priorities = p.map((k, v) => MapEntry(k.toString(), (v ?? 0).toInt()));
        capacities = {
          for (var h = 0; h < 24; h++) h: (c.containsKey(h.toString()) ? (c[h.toString()] ?? 0).toInt() : 0)
        };
        loading = false;
      });
    } catch (e) {
      setState(() {
        error = '設定取得失敗: ${e.toString()}';
        loading = false;
      });
    }
  }

  Future<void> _saveConfig() async {
    if (!(_formKey.currentState?.validate() ?? true)) return;
    setState(() { saving = true; error = null; });
    try {
      final auth = ref.read(authProvider.notifier);
      final payload = {
        "priorities": priorities,
        "capacities": capacities.map((k, v) => MapEntry(k.toString(), v)),
      };
      await auth.saveAutoAdjustConfig(widget.shopId, payload);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('設定を保存したで')));
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('保存失敗: ${e.toString()}')));
    } finally {
      setState(() { saving = false; });
    }
  }

  Future<void> _simulate({required bool apply}) async {
    setState(() { simulating = true; error = null; simResult = null; });
    try {
      final auth = ref.read(authProvider.notifier);
      final dateStr = _formatDate(targetDate);
      final resp = await auth.runAutoAdjust(widget.shopId, dateStr, apply: apply);
      setState(() { simResult = resp; });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apply ? '適用したで' : 'シミュレーション完了やで')));
    } catch (e) {
      setState(() { error = '自動調整失敗: ${e.toString()}'; });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('自動調整失敗: ${e.toString()}')));
    } finally {
      setState(() { simulating = false; });
    }
  }

  void _addPriorityRow() {
    final newId = DateTime.now().millisecondsSinceEpoch.toString();
    setState(() { priorities[newId] = 0; });
  }

  void _removePriority(String userId) {
    setState(() { priorities.remove(userId); });
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).value;
    final shopId = widget.shopId;

    if (loading) {
      return AppScaffold(
        title: '自動調整設定',
        userRole: user?.role ?? 'admin',
        shopId: shopId,
        userName: user?.userName,
        shopName: user?.shopName,
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return AppScaffold(
      title: '自動調整設定',
      userRole: user?.role ?? 'admin',
      shopId: shopId,
      userName: user?.userName,
      shopName: user?.shopName,
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 日付選択
                Row(
                  children: [
                    const Text('対象日: ', style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(width: 8),
                    TextButton(
                      onPressed: () async {
                        final d = await showDatePicker(
                          context: context,
                          initialDate: targetDate,
                          firstDate: DateTime.now().subtract(const Duration(days: 365)),
                          lastDate: DateTime.now().add(const Duration(days: 365)),
                        );
                        if (d != null) setState(() { targetDate = d; });
                      },
                      child: Text(_formatDate(targetDate)),
                    ),
                    const Spacer(),
                    ElevatedButton(
                      onPressed: simulating ? null : () => _simulate(apply: false),
                      child: simulating ? const SizedBox(width:16,height:16,child:CircularProgressIndicator(strokeWidth:2)) : const Text('シミュレーション'),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: simulating ? null : () async {
                        final ok = await showDialog<bool>(
                          context: context,
                          builder: (_) => AlertDialog(
                            title: const Text('本当に適用する？'),
                            content: const Text('確定をDBに書き込みます。よろしい？'),
                            actions: [
                              TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('キャンセル')),
                              TextButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('適用')),
                            ],
                          ),
                        );
                        if (ok == true) await _simulate(apply: true);
                      },
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
                      child: simulating ? const SizedBox(width:16,height:16,child:CircularProgressIndicator(strokeWidth:2)) : const Text('適用'),
                    ),
                  ],
                ),

                const SizedBox(height: 12),
                const Text('従業員優先度 (userId -> priority)', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),

                // 優先度リスト + 行追加ボタン（行追加は別表示）
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ListView(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      children: priorities.entries.map((entry) {
                        final uid = entry.key;
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            children: [
                              Expanded(
                                flex: 3,
                                child: Row(
                                  children: [
                                    Expanded(child: Text(uid)),
                                    IconButton(
                                      icon: const Icon(Icons.edit, size: 18),
                                      onPressed: () async {
                                        final newId = await showDialog<String?>(
                                          context: context,
                                          builder: (ctx) {
                                            final tc = TextEditingController(text: uid);
                                            return AlertDialog(
                                              title: const Text('userId を編集'),
                                              content: TextField(controller: tc),
                                              actions: [
                                                TextButton(onPressed: () => Navigator.of(ctx).pop(null), child: const Text('キャンセル')),
                                                TextButton(onPressed: () => Navigator.of(ctx).pop(tc.text.trim()), child: const Text('保存')),
                                              ],
                                            );
                                          },
                                        );
                                        if (newId != null && newId.isNotEmpty && newId != uid) {
                                          final val = priorities[uid];
                                          setState(() {
                                            priorities.remove(uid);
                                            priorities[newId] = val ?? 0;
                                          });
                                        }
                                      },
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                flex: 2,
                                child: TextFormField(
                                  initialValue: priorities[uid].toString(),
                                  keyboardType: TextInputType.number,
                                  decoration: const InputDecoration(labelText: 'priority'),
                                  onChanged: (v) {
                                    final parsed = int.tryParse(v) ?? 0;
                                    setState(() { priorities[uid] = parsed; });
                                  },
                                ),
                              ),
                              IconButton(icon: const Icon(Icons.delete_outline), onPressed: () => _removePriority(uid)),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 6),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(onPressed: _addPriorityRow, icon: const Icon(Icons.add), label: const Text('行追加')),
                    ),
                  ],
                ),

                const SizedBox(height: 16),
                const Text('営業時間ごとの定員', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: 24,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 4, childAspectRatio: 4.5, crossAxisSpacing: 8, mainAxisSpacing: 8),
                  itemBuilder: (context, idx) {
                    return Row(
                      children: [
                        SizedBox(width: 32, child: Text('$idx:00')),
                        const SizedBox(width: 6),
                        Expanded(
                          child: TextFormField(
                            initialValue: (capacities[idx] ?? 0).toString(),
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(border: OutlineInputBorder(), isDense: true, contentPadding: EdgeInsets.symmetric(vertical:8,horizontal:8)),
                            onChanged: (v) {
                              final n = int.tryParse(v) ?? 0;
                              setState(() { capacities[idx] = n; });
                            },
                          ),
                        ),
                      ],
                    );
                  },
                ),

                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton(
                        onPressed: saving ? null : _saveConfig,
                        child: saving ? const SizedBox(width:16,height:16,child:CircularProgressIndicator(strokeWidth:2)) : const Text('設定を保存'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: () { _loadConfig(); },
                      child: const Text('リロード'),
                    ),
                  ],
                ),

                const SizedBox(height: 16),
                if (error != null) Text(error!, style: const TextStyle(color: Colors.red)),
                if (simResult != null) ...[
                  const Divider(),
                  const Text('シミュレーション結果', style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text('メトリクス: ${simResult!['metrics'] ?? {}}'),
                  const SizedBox(height: 8),
                  const Text('割当一覧:', style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 6),
                  ...List<Widget>.from(((simResult!['assignments'] ?? []) as List).map((a) {
                    return ListTile(
                      dense: true,
                      title: Text('${a['user_id'] ?? ''}  ${a['start_time'] ?? ''} - ${a['end_time'] ?? ''}'),
                      subtitle: Text(''),
                    );
                  })),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
// ...existing code...