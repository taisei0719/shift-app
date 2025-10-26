import 'package:flutter/material.dart';

class AppScaffold extends StatelessWidget {
  final Widget body;
  final String title;

  const AppScaffold({
    Key? key,
    required this.body,
    this.title = 'ホーム',
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        leading: Builder(
          builder: (context) => IconButton(
            icon: Icon(Icons.menu),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
      ),
      drawer: Drawer(
        child: ListView(
          children: [
            DrawerHeader(child: Text('メニュー')),
            ListTile(
              leading: Icon(Icons.home),
              title: Text('ホーム'),
              onTap: () => Navigator.of(context).pushReplacementNamed('/home'),
            ),
            ListTile(
              leading: Icon(Icons.calendar_today),
              title: Text('シフト一覧'),
              onTap: () => Navigator.of(context).pushNamed('/shifts'),
            ),
            ListTile(
              leading: Icon(Icons.person),
              title: Text('アカウント編集'),
              onTap: () => Navigator.of(context).pushNamed('/edit_account'),
            ),
            // 他にもメニュー追加できるで！
          ],
        ),
      ),
      body: body,
      bottomNavigationBar: BottomAppBar(
        child: IconButton(
          icon: Icon(Icons.home),
          onPressed: () => Navigator.of(context).pushReplacementNamed('/home'),
        ),
      ),
    );
  }
}