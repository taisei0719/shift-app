# -------------------- API: シフト確定・手動調整 (Admin専用) --------------------
@app.route("/api/admin/shifts/confirm", methods=["POST"])
def confirm_shifts():
    user_id = session.get("user_id")
    shop_id = session.get("shop_id")
    
    # 1. ログイン/権限/所属店舗チェック
    if not user_id or session.get("role") != 'admin':
        return jsonify({"error": "管理者権限が必要です"}), 403
    if not shop_id:
        return jsonify({"error": "管理店舗が登録されていません"}), 400

    data = request.json
    confirmed_shifts_data = data.get("confirmed_shifts", [])
    
    if not confirmed_shifts_data:
        return jsonify({"error": "確定シフトデータがありません"}), 400
        
    try:
        # データから日付を取得（全て同じ日付のはず）
        date_str = confirmed_shifts_data[0]['shift_date']
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        
        target_user_ids = [shift['user_id'] for shift in confirmed_shifts_data]
        
        # 削除対象の確定シフトを読み込む
        shifts_to_delete = Shift.query.filter(
            Shift.shop_id == shop_id,
            Shift.shift_date == target_date,
            Shift.shift_type == 'confirmed',
            # 今回確定処理を行うユーザーの分だけを対象にする
            Shift.user_id.in_(target_user_ids) 
        ).all()
        
        # 読み込んだオブジェクトを一つずつ削除
        for shift in shifts_to_delete:
            db.session.delete(shift)
        
        # ここで削除をDBに確定させる（これが重要！）
        db.session.flush()


        new_confirmed_shifts = []
        
        # 3. 新しい確定シフトをDBに追加
        for shift_data in confirmed_shifts_data:
            # 入力チェック (user_id, start_time, end_time が必須)
            if 'user_id' not in shift_data or 'start_time' not in shift_data or 'end_time' not in shift_data:
                 continue # 不正なデータはスキップ

            start_time_obj = datetime.strptime(shift_data['start_time'], '%H:%M').time()
            end_time_obj = datetime.strptime(shift_data['end_time'], '%H:%M').time()
            
            new_shift = Shift(
                user_id=shift_data['user_id'],
                shop_id=shop_id,
                shift_date=target_date,
                start_time=start_time_obj,
                end_time=end_time_obj,
                shift_type='confirmed' # 確定済みとして登録
            )
            db.session.add(new_shift)
            new_confirmed_shifts.append(new_shift)

        db.session.commit()
        return jsonify({"message": f"日付 {date_str} のシフトを{len(new_confirmed_shifts)}件確定しました。"}), 200

    except Exception as e:
        db.session.rollback()
        db.session.remove()
        print(f"シフト確定エラー: {e}")
        return jsonify({"error": f"シフト確定処理中にエラーが発生しました: {str(e)}"}), 500